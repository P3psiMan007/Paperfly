import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  PanResponder,
  Platform,
  Share,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import * as Haptics from "expo-haptics";
import PaperPlane from "../src/PaperPlane";
import {
  FOCAL,
  FAR_Z,
  SPAWN_Z,
  PLANE_SIZE,
  BASE_SPEED,
  BOOST_SPEED,
  BRAKE_SPEED,
  PLANE_X_RANGE,
  PLANE_Y_RANGE,
  WorldObj,
  GameState,
  PowerupKind,
  POWERUP_DURATIONS,
  POWERUP_THEME,
} from "../src/game/projection";
import {
  Overlay,
  TiltIndicator,
  BoostLines,
  ParallaxClouds,
  PowerupHud,
} from "../src/game/Hud";
import {
  ENVIRONMENTS,
  environmentForScore,
  Environment,
} from "../src/game/environment";
import { Coin } from "../src/game/Coin";
import {
  loadCalibration,
  saveCalibration,
  loadSensitivity,
  Calibration,
} from "../src/storage";
import {
  loadProgress,
  saveProgress,
  applyRun,
  Progress,
  DEFAULT_PROGRESS,
  RunResult,
} from "../src/progression";
import { SKINS, ACHIEVEMENTS, AchievementId, SkinId } from "../src/skins";
import { mulberry32, todaySeed, todaySeedString } from "../src/daily";
import { playSfx, preloadSounds, loadSfxEnabled } from "../src/audio";
import { isHapticsEnabled as hapticsOn, loadHapticsEnabled } from "../src/haptics";
import { GameButton } from "../src/ui/GameButton";
import { Confetti } from "../src/ui/Confetti";
import { Reveal } from "../src/ui/Reveal";
import { useReducedMotion } from "../src/ui/useReducedMotion";

// Map of which skins unlock from which achievement (kept here to avoid circular imports)
// Which achievement unlocks which skin. The reverse map (skin -> achievement)
// must be in sync with src/skins.ts; we keep it here as the canonical lookup
// the run-resolver uses.
const SKIN_BY_ACHIEVEMENT: Partial<Record<SkinId, AchievementId>> = {
  mint: "rings_25",
  storm: "rings_100",
  phoenix: "score_1500",
  galaxy: "survive_90",
  neon: "combo_15",
  stealth: "score_3000",
};
const SKINS_BY_LEVEL: { id: SkinId; level: number }[] = [
  { id: "skyblue", level: 3 },
  { id: "sunset", level: 5 },
  { id: "crimson", level: 8 },
  { id: "ocean", level: 10 },
  { id: "aurora", level: 12 },
];

let nextId = 1;

export default function Game() {
  const router = useRouter();
  const params = useLocalSearchParams<{ calibrate?: string; daily?: string }>();
  const { width: SW, height: SH } = useWindowDimensions();
  const isDaily = params.daily === "1";
  const dailyRngRef = useRef<(() => number) | null>(null);

  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  // Snapshot captured at game-over for the results screen: the final score, the
  // best/longest BEFORE this run was applied (so we can show "+N vs best"
  // deltas), used by the count-up reveal and diff chips.
  const [runSnapshot, setRunSnapshot] = useState<{
    score: number;
    prevBest: number;
    seconds: number;
    prevLongest: number;
  } | null>(null);
  // Score number that counts up on the game-over screen (0 → final).
  const [countScore, setCountScore] = useState(0);
  // Set true ~2s after game over to start the "tap to retry" button pulse.
  const [retryPulse, setRetryPulse] = useState(false);
  // Bumped each game over so the confetti + staggered reveals re-fire.
  const [gameOverNonce, setGameOverNonce] = useState(0);
  // Launch countdown shown after tapping FLY on the Ready overlay: 3 → 2 → 1 →
  // GO, then the run starts. null = not counting. Gives the player a beat to
  // re-grip before tilt control goes live (research §0/§5, audit 2.2.1).
  const [launchCountdown, setLaunchCountdown] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [boostActive, setBoostActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState(3);
  // True once we've confirmed (after ~1.2 s) that no tilt sensor is delivering
  // events — happens on desktop browsers and on iOS Safari when motion
  // permission is denied. We show a friendly "open on your phone" overlay
  // instead of a frozen game.
  const [noSensor, setNoSensor] = useState(false);

  const sensRef = useRef(1.0);
  const calibRef = useRef<Calibration>({ pitch: 0, roll: 0 });
  const rawTiltRef = useRef({ pitch: 0, roll: 0 });
  const smoothTiltRef = useRef({ pitch: 0, roll: 0 });
  const objectsRef = useRef<WorldObj[]>([]);
  // Keep window dimensions visible to the [] -deps game loop without restarting it.
  const dimsRef = useRef({ SW, SH });
  useEffect(() => {
    dimsRef.current = { SW, SH };
  }, [SW, SH]);
  const lastFrameRef = useRef(performance.now());
  const lastSpawnRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const boostRef = useRef(false);
  const brakeRef = useRef(false);
  const stateRef = useRef<GameState>("ready");
  const scoreRef = useRef(0);
  const collectedRingsRef = useRef(0);
  const cloudOffsetRef = useRef(0);
  // Run stats for progression
  const runStartRef = useRef(0);
  const boostsThisRunRef = useRef(0);
  const wasBoostingRef = useRef(false);
  // Combo: consecutive coins without crashing. Crash resets it. Score from a
  // coin = 50 * comboMultiplier (caps at 5x).
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  // Wall-clock ms when the combo will lapse if no coin is grabbed. A coin
  // refreshes this; if you don't grab one inside this window the streak resets
  // even without crashing (so combos take effort to sustain).
  const comboExpiresRef = useRef(0);
  // Last announced multiplier tier (1..5). Compared against the freshly
  // computed mult on each ring grab so the tier-up popup + haptic fires
  // only on the coin that crosses the threshold, not on every coin at
  // that tier. Reset to 1 on world reset, crash, and combo lapse.
  const comboTierRef = useRef(1);
  // performance.now() ms until which the score HUD pill scales up to
  // celebrate a tier-up. Read at render time; the game loop's setTick
  // already drives a re-render every frame during play.
  const scoreFlashUntilRef = useRef(0);
  const [combo, setCombo] = useState(0);
  // Powerups. Shield is binary (one-shot), magnet/slowmo are timestamps for
  // when the effect expires. Mirrored to React state for the HUD.
  const shieldRef = useRef(false);
  const magnetUntilRef = useRef(0);
  const slowmoUntilRef = useRef(0);
  const [shieldActive, setShieldActive] = useState(false);
  const [magnetUntilHud, setMagnetUntilHud] = useState(0);
  const [slowmoUntilHud, setSlowmoUntilHud] = useState(0);
  // Current sky environment. Updated only when the score crosses a threshold
  // so we don't churn React state every frame.
  const [env, setEnv] = useState<Environment>(ENVIRONMENTS[0]);
  const envIdRef = useRef<Environment["id"]>(ENVIRONMENTS[0].id);
  const calibTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Calibration averaging: sample raw tilt continuously during the hold window
  // and use the mean, so a single twitch can't lock in a bad neutral pose.
  const calibSamplerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calibAccumRef = useRef({ pitch: 0, roll: 0, n: 0 });

  const [, setTick] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  // performance.now() ms until which the environment phase-transition
  // white-flash overlay is visible. Set on env bucket change; the
  // render computes a 0..0.45 opacity from how much time remains.
  const phaseFlashUntilRef = useRef(0);
  // Crash juice. crashingRef freezes the world for a beat so the screen shake
  // reads before the game-over overlay arrives (research §1.1/§1.2). The loop
  // keeps re-rendering while frozen so the shake animates; endGame fires after.
  const crashingRef = useRef(false);
  const shakeUntilRef = useRef(0);
  // Coin-collect particle burst. Plain absolutely-positioned Views.
  // Position is screen-space, velocity is px/sec, life is ms. Same
  // dumb-struct shape as popupsRef so the loop owns spawning, ticking,
  // and culling without any new abstractions.
  const particlesRef = useRef<
    {
      id: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      t: number;
      life: number;
      size: number;
      color: string;
    }[]
  >([]);
  // Popups: floating world labels. `kind` switches the render style.
  //   - undefined or "score": legacy +N number popup (yellow, floats up).
  //   - "powerup" / "tier": legacy label popup (white, floats up).
  //   - "phase": big centered environment banner that fades in then out
  //     without floating, used by the new act-break treatment.
  // Adding new kinds here is preferred over new top-level arrays so the
  // single 1 s cleanup filter keeps owning popup lifetime.
  const popupsRef = useRef<
    {
      id: number;
      value: number;
      t: number;
      label?: string;
      kind?: "phase";
    }[]
  >([]);

  useEffect(() => {
    stateRef.current = state;
    // Reset the frame clock whenever we (re)enter the playing state so the
    // first frame doesn't carry a huge dt from however long we were on the
    // ready/paused/gameover overlay.
    if (state === "playing") {
      lastFrameRef.current = performance.now();
    }
  }, [state]);

  // Game-over results animation: count the score up from 0 to final with an
  // ease-out, ticking a soft chime + light haptic at every 250 points so the
  // reveal has anticipation instead of just printing a number (research §1.4 /
  // audit 2.4.1). Then, after ~2s, start the retry-button pulse (audit 2.4.7).
  useEffect(() => {
    if (state !== "gameover" || !runSnapshot) return;
    const target = runSnapshot.score;
    const dur = 1200;
    const start = performance.now();
    let raf = 0;
    let lastBucket = -1;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const val = Math.round(target * eased);
      setCountScore(val);
      const bucket = Math.floor(val / 250);
      if (bucket > lastBucket && val < target && val > 0) {
        lastBucket = bucket;
        playSfx("ring", 0.22);
        if (Platform.OS !== "web" && hapticsOn()) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {}
          );
        }
      }
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setCountScore(target);
      }
    };
    raf = requestAnimationFrame(step);
    const pulseTimer = setTimeout(() => setRetryPulse(true), 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pulseTimer);
    };
  }, [state, runSnapshot]);

  // Drive the launch countdown: tick 3 → 2 → 1 → 0(GO) every 600ms with a
  // selection haptic each beat, then go live shortly after GO.
  useEffect(() => {
    if (launchCountdown === null) return;
    if (Platform.OS !== "web" && hapticsOn()) {
      Haptics.selectionAsync().catch(() => {});
    }
    if (launchCountdown <= 0) {
      // "GO" frame — start the run after a short hold.
      const go = setTimeout(() => {
        setLaunchCountdown(null);
        setState("playing");
        stateRef.current = "playing";
        lastFrameRef.current = performance.now();
      }, 380);
      return () => clearTimeout(go);
    }
    const t = setTimeout(() => {
      setLaunchCountdown((c) => (c === null ? null : c - 1));
    }, 600);
    return () => clearTimeout(t);
  }, [launchCountdown]);

  useEffect(() => {
    loadSensitivity().then((s) => (sensRef.current = s));
    loadCalibration().then((c) => (calibRef.current = c));
    loadProgress().then(setProgress);
    // Hydrate sound preference + preload bundled SFX so playSfx() actually
    // plays something. Without this, players are never created and every
    // call is a silent no-op.
    loadSfxEnabled().then(() => {
      preloadSounds().catch(() => {});
    });
    loadHapticsEnabled();
  }, []);

  // Sensor subscription — prefer DeviceMotion (gravity-compensated, more
  // stable) and fall back to Accelerometer if DeviceMotion is unavailable OR
  // never delivers an event within ~600 ms (permission denied / OS quirks).
  // If neither sensor ever fires, surface a "no sensor" overlay so users on
  // desktop browsers see a clear message instead of an unresponsive plane.
  useEffect(() => {
    let accelSub: any = null;
    let dmSub: any = null;
    let cancelled = false;
    let anyEventReceived = false;
    let dmEventReceived = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let noSensorTimer: ReturnType<typeof setTimeout> | null = null;

    const markEvent = () => {
      anyEventReceived = true;
    };

    const subscribeAccelerometer = async () => {
      if (cancelled || accelSub) return;
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (!cancelled && ok) {
          Accelerometer.setUpdateInterval(33);
          accelSub = Accelerometer.addListener(({ x, y }) => {
            markEvent();
            rawTiltRef.current = { roll: x, pitch: y };
          });
        }
      } catch {}
    };

    (async () => {
      let dmAvailable = false;
      try {
        dmAvailable = await DeviceMotion.isAvailableAsync();
      } catch {
        dmAvailable = false;
      }

      if (dmAvailable) {
        try {
          DeviceMotion.setUpdateInterval(33); // ~30 Hz, smoother
          dmSub = DeviceMotion.addListener((data: any) => {
            markEvent();
            dmEventReceived = true;
            const r = data?.rotation;
            if (r) {
              const roll = Math.max(-1, Math.min(1, (r.gamma || 0) / 0.7));
              const pitch = Math.max(-1, Math.min(1, (r.beta || 0) / 0.7));
              rawTiltRef.current = { roll, pitch };
            }
          });
          // If DeviceMotion never delivers an event, fall back.
          fallbackTimer = setTimeout(() => {
            if (!cancelled && !dmEventReceived) {
              try {
                dmSub?.remove();
              } catch {}
              dmSub = null;
              subscribeAccelerometer();
            }
          }, 600);
        } catch {
          await subscribeAccelerometer();
        }
      } else {
        await subscribeAccelerometer();
      }

      // Final check: if no tilt event has arrived by 1.2 s after mount,
      // assume we're somewhere without motion input (desktop browser /
      // permission denied) and surface a friendly message.
      noSensorTimer = setTimeout(() => {
        if (!cancelled && !anyEventReceived) {
          setNoSensor(true);
        }
      }, 1200);
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (noSensorTimer) clearTimeout(noSensorTimer);
      if (accelSub) accelSub.remove();
      if (dmSub) dmSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSensitivity().then((s) => (sensRef.current = s));
      loadCalibration().then((c) => (calibRef.current = c));
      loadProgress().then(setProgress);
    }, [])
  );

  useEffect(() => {
    if (params.calibrate === "1" && state === "ready") {
      setTimeout(() => doCalibrate(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.calibrate]);

  const doCalibrate = () => {
    if (calibTimerRef.current) {
      clearInterval(calibTimerRef.current);
      calibTimerRef.current = null;
    }
    if (calibSamplerRef.current) {
      clearInterval(calibSamplerRef.current);
      calibSamplerRef.current = null;
    }
    setCalibrating(true);
    setCalibCountdown(3);
    calibAccumRef.current = { pitch: 0, roll: 0, n: 0 };

    // Sample at ~30 Hz throughout the hold window. We skip the very first
    // ~250 ms of samples so the user's tap-induced motion doesn't bias the
    // mean.
    const sampleStart = performance.now();
    calibSamplerRef.current = setInterval(() => {
      if (performance.now() - sampleStart < 250) return;
      const cur = rawTiltRef.current;
      calibAccumRef.current.pitch += cur.pitch;
      calibAccumRef.current.roll += cur.roll;
      calibAccumRef.current.n += 1;
    }, 33);

    let n = 3;
    calibTimerRef.current = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCalibCountdown(n);
      } else {
        if (calibTimerRef.current) {
          clearInterval(calibTimerRef.current);
          calibTimerRef.current = null;
        }
        if (calibSamplerRef.current) {
          clearInterval(calibSamplerRef.current);
          calibSamplerRef.current = null;
        }
        const a = calibAccumRef.current;
        const newCal =
          a.n > 0
            ? { pitch: a.pitch / a.n, roll: a.roll / a.n }
            : { ...rawTiltRef.current };
        calibRef.current = newCal;
        saveCalibration(newCal);
        setCalibrating(false);
        if (Platform.OS !== "web" && hapticsOn()) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
      }
    }, 700);
  };

  // Cleanup calibration timers on unmount
  useEffect(() => {
    return () => {
      if (calibTimerRef.current) {
        clearInterval(calibTimerRef.current);
        calibTimerRef.current = null;
      }
      if (calibSamplerRef.current) {
        clearInterval(calibSamplerRef.current);
        calibSamplerRef.current = null;
      }
    };
  }, []);

  const resetWorld = () => {
    objectsRef.current = [];
    scoreRef.current = 0;
    collectedRingsRef.current = 0;
    speedRef.current = BASE_SPEED;
    boostRef.current = false;
    brakeRef.current = false;
    smoothTiltRef.current = { pitch: 0, roll: 0 };
    setBoostActive(false);
    setBrakeActive(false);
    setScore(0);
    lastFrameRef.current = performance.now();
    lastSpawnRef.current = 0;
    runStartRef.current = performance.now();
    boostsThisRunRef.current = 0;
    wasBoostingRef.current = false;
    comboRef.current = 0;
    bestComboRef.current = 0;
    comboExpiresRef.current = 0;
    comboTierRef.current = 1;
    scoreFlashUntilRef.current = 0;
    phaseFlashUntilRef.current = 0;
    crashingRef.current = false;
    shakeUntilRef.current = 0;
    particlesRef.current = [];
    setCombo(0);
    shieldRef.current = false;
    magnetUntilRef.current = 0;
    slowmoUntilRef.current = 0;
    setShieldActive(false);
    setMagnetUntilHud(0);
    setSlowmoUntilHud(0);
    envIdRef.current = ENVIRONMENTS[0].id;
    setEnv(ENVIRONMENTS[0]);
    setRunResult(null);
    setRunSnapshot(null);
    setCountScore(0);
    setRetryPulse(false);
    // Reset daily RNG so the same daily is reproducible per attempt
    dailyRngRef.current = isDaily ? mulberry32(todaySeed()) : null;
  };

  const startGame = () => {
    setLaunchCountdown(null);
    resetWorld();
    setState("playing");
    stateRef.current = "playing";
  };

  // Ready-overlay launch: reset the world, then run a 3-2-1-GO countdown before
  // going live. The world stays frozen (state isn't "playing" yet) during the
  // count so nothing moves until GO.
  const beginLaunch = () => {
    resetWorld();
    setLaunchCountdown(3);
  };

  const endGame = async () => {
    setState("gameover");
    stateRef.current = "gameover";
    if (Platform.OS !== "web" && hapticsOn()) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});
    }
    const finalScore = Math.floor(scoreRef.current);
    const seconds = Math.max(
      0,
      Math.round((performance.now() - runStartRef.current) / 1000)
    );
    const stats = {
      score: finalScore,
      rings: collectedRingsRef.current,
      seconds,
      boosts: boostsThisRunRef.current,
      crashed: true,
      bestCombo: bestComboRef.current,
    };
    try {
      const cur = await loadProgress();
      const { next, result } = applyRun(
        cur,
        stats,
        SKIN_BY_ACHIEVEMENT,
        SKINS_BY_LEVEL
      );
      // Track daily best for this seed
      if (isDaily) {
        const seedStr = todaySeedString();
        const prevDaily =
          next.lastDailySeed === seedStr ? next.lastDailyScore || 0 : 0;
        next.lastDailySeed = seedStr;
        next.lastDailyScore = Math.max(prevDaily, finalScore);
      }
      // Snapshot the pre-run best/longest for the results-screen deltas.
      setRunSnapshot({
        score: finalScore,
        prevBest: cur.bestScore,
        seconds,
        prevLongest: cur.longestRunSec,
      });
      await saveProgress(next);
      setProgress(next);
      setRunResult(result);
      setGameOverNonce((n) => n + 1);
    } catch (e) {
      console.warn("apply run failed", e);
    }
  };

  // Quitting mid-run throws away the current score, so confirm it with the
  // amount at stake (loss-aversion framing — see the research brief §2.3).
  const confirmQuit = () => {
    const cur = Math.floor(scoreRef.current);
    if (cur <= 0) {
      router.replace("/");
      return;
    }
    Alert.alert(
      "Quit this run?",
      `You'll lose your current ${cur} points.`,
      [
        { text: "Keep flying", style: "cancel" },
        {
          text: "Quit",
          style: "destructive",
          onPress: () => router.replace("/"),
        },
      ]
    );
  };

  const shareScore = async () => {
    const finalScore = Math.floor(scoreRef.current);
    const tag = isDaily
      ? `Daily Challenge ${todaySeedString()}`
      : "Paper Fly";
    const message = `${tag} — I scored ${finalScore} points and collected ${collectedRingsRef.current} rings! Can you beat me? ✈️`;
    try {
      await Share.share({ message });
    } catch {}
  };

  // Game loop
  useEffect(() => {
    let raf: any = null;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      if (stateRef.current === "playing" && crashingRef.current) {
        // Crash freeze: world is paused for the shake beat. Keep re-rendering
        // so the screen shake (computed from shakeUntilRef in render) animates,
        // but advance nothing else. endGame() fires from the crash handler.
        setTick((t) => (t + 1) % 1000000);
      } else if (stateRef.current === "playing") {
        const raw = rawTiltRef.current;
        const cal = calibRef.current;

        // Apply dead zone to ignore micro-jitter (sensor noise / hand tremor)
        const DEAD_ZONE = 0.06;
        const applyDeadZone = (v: number) => {
          if (Math.abs(v) < DEAD_ZONE) return 0;
          // Re-scale so output starts smoothly from 0 past the dead zone
          const sign = v < 0 ? -1 : 1;
          return sign * ((Math.abs(v) - DEAD_ZONE) / (1 - DEAD_ZONE));
        };

        const rawRoll = applyDeadZone(raw.roll - cal.roll);
        const rawPitch = applyDeadZone(raw.pitch - cal.pitch);
        const targetRoll = Math.max(-1, Math.min(1, rawRoll));
        const targetPitch = Math.max(-1, Math.min(1, rawPitch));

        // Heavier smoothing on pitch (vertical) to kill jitter; roll stays responsive.
        const SMOOTH_ROLL = 0.18;
        const SMOOTH_PITCH = 0.07;
        smoothTiltRef.current.roll +=
          (targetRoll - smoothTiltRef.current.roll) * SMOOTH_ROLL;
        smoothTiltRef.current.pitch +=
          (targetPitch - smoothTiltRef.current.pitch) * SMOOTH_PITCH;

        const target = boostRef.current
          ? BOOST_SPEED
          : brakeRef.current
          ? BRAKE_SPEED
          : BASE_SPEED;
        speedRef.current += (target - speedRef.current) * 0.08;

        // Slow-mo scales the effective world dt without touching real-time
        // animation rate. Objects move at 45 % speed while it's active.
        const slowmoActive = slowmoUntilRef.current > now;
        const effectiveDt = slowmoActive ? dt * 0.45 : dt;

        scoreRef.current += effectiveDt * (speedRef.current / BASE_SPEED) * 10;

        // Combo lapses if no coin is grabbed inside the window.
        if (
          comboRef.current > 0 &&
          comboExpiresRef.current > 0 &&
          now > comboExpiresRef.current
        ) {
          comboRef.current = 0;
          comboExpiresRef.current = 0;
          comboTierRef.current = 1;
          setCombo(0);
        }

        // Environment shift: only push to React state when the bucket changes,
        // so the LinearGradient remounts at most a handful of times per run.
        const nextEnv = environmentForScore(scoreRef.current);
        if (nextEnv.id !== envIdRef.current) {
          envIdRef.current = nextEnv.id;
          setEnv(nextEnv);
          // Phase transition juice: big centered banner + 600 ms white
          // flash overlay + warning haptic. Marks the act break so the
          // sky change feels intentional, not just a UI tick.
          phaseFlashUntilRef.current = now + 600;
          popupsRef.current.push({
            id: nextId++,
            value: 0,
            t: now,
            label: nextEnv.name.toUpperCase(),
            kind: "phase",
          });
          if (Platform.OS !== "web" && hapticsOn()) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});
          }
        }

        cloudOffsetRef.current =
          (cloudOffsetRef.current + speedRef.current * effectiveDt * 0.4) %
          1000;

        // Cleanup old score popups (>1s)
        if (popupsRef.current.length) {
          popupsRef.current = popupsRef.current.filter(
            (p) => now - p.t < 1000
          );
        }

        // Advance + cull coin-collect particles. effectiveDt so slow-mo
        // also slows the radiation; the burst feels coherent with the
        // rest of the slowed world. Cheap O(n) walk, n caps at ~30 per
        // tier-5 grab so this is trivial.
        if (particlesRef.current.length) {
          for (const pt of particlesRef.current) {
            pt.x += pt.vx * effectiveDt;
            pt.y += pt.vy * effectiveDt;
          }
          particlesRef.current = particlesRef.current.filter(
            (pt) => now - pt.t < pt.life
          );
        }

        lastSpawnRef.current += dt;
        if (lastSpawnRef.current >= 0.55) {
          lastSpawnRef.current = 0;
          const rand = dailyRngRef.current ? dailyRngRef.current : Math.random;
          const r0 = rand();
          // Slot allocation: 3 % powerup, 57 % ring, 40 % obstacle.
          let type: WorldObj["type"];
          let powerup: PowerupKind | undefined;
          if (r0 < 0.03) {
            type = "powerup";
            const pr = rand();
            powerup = pr < 0.4 ? "shield" : pr < 0.75 ? "magnet" : "slowmo";
          } else if (r0 < 0.60) {
            type = "ring";
          } else {
            type = "obstacle";
          }
          const baseSize =
            type === "ring" ? 55 : type === "powerup" ? 60 : 70 + rand() * 30;
          const hue =
            type === "ring"
              ? "#FDE047"
              : type === "obstacle"
              ? // Saturated reds (red-600 / rose-600) instead of the old
                // pastel pink — obstacles need to say "dodge me", not
                // "soft pillow". Splitters override this fill anyway.
                rand() < 0.5
                ? "#DC2626"
                : "#E11D48"
              : powerup
              ? POWERUP_THEME[powerup].color
              : "#FFFFFF";
          // Obstacle behavior: 25 % drift (slow lateral motion), 10 % split.
          // Drift and split can both apply to the same obstacle.
          let vx: number | undefined;
          let willSplit = false;
          let variant: 0 | 1 | 2 | undefined;
          if (type === "obstacle") {
            if (rand() < 0.25) {
              const dir = rand() < 0.5 ? -1 : 1;
              vx = dir * (35 + rand() * 35); // 35–70 world units / sec
            }
            if (rand() < 0.1) {
              willSplit = true;
            }
            // Visual variant distribution: 50 % chevron, 30 % warning,
            // 20 % lozenge. Splitter render takes precedence, so a
            // splitter that rolled variant 2 (rotated) still shows
            // the upright orange + X marker; the variant just affects
            // its post-split children.
            const vr = rand();
            variant = vr < 0.5 ? 0 : vr < 0.8 ? 1 : 2;
          }
          objectsRef.current.push({
            id: nextId++,
            type,
            x: (rand() - 0.5) * PLANE_X_RANGE * 2.4,
            y: (rand() - 0.5) * PLANE_Y_RANGE * 2.0,
            z: SPAWN_Z + rand() * 100,
            baseSize,
            hue,
            powerup,
            vx,
            willSplit,
            variant,
          });
        }

        const planeWorldX =
          smoothTiltRef.current.roll * sensRef.current * PLANE_X_RANGE;
        const planeWorldY =
          -smoothTiltRef.current.pitch * sensRef.current * PLANE_Y_RANGE;

        // Project the plane to screen the SAME way it's drawn in the render
        // pass below — so "what you see" matches "what collides."
        const SWnow = dimsRef.current.SW;
        const SHnow = dimsRef.current.SH;
        const cxNow = SWnow / 2;
        const planeAnchorYNow = SHnow * 0.62;
        const planeScreenXNow =
          cxNow + smoothTiltRef.current.roll * sensRef.current * 90;
        const planeScreenYNow =
          planeAnchorYNow + smoothTiltRef.current.pitch * sensRef.current * 70;

        const magnetActive = magnetUntilRef.current > now;

        const objs = objectsRef.current;
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i];
          o.z -= speedRef.current * effectiveDt;
          if (o.z <= 5) {
            objs.splice(i, 1);
            continue;
          }
          // Magnet: pull near rings toward the plane's world position. We
          // ease X/Y at ~7%/frame while the powerup is live and the ring is
          // still in range.
          if (magnetActive && o.type === "ring" && o.z < 350) {
            o.x += (planeWorldX - o.x) * 0.07;
            o.y += (planeWorldY - o.y) * 0.07;
          }
          // Obstacle drift: apply lateral velocity. Bounce when crossing the
          // spawn extent so they stay roughly in play.
          if (o.type === "obstacle" && o.vx) {
            o.x += o.vx * effectiveDt;
            const limit = PLANE_X_RANGE * 1.3;
            if (o.x > limit) {
              o.x = limit;
              o.vx = -o.vx;
            } else if (o.x < -limit) {
              o.x = -limit;
              o.vx = -o.vx;
            }
          }
          // Splitter: at close range, fire once into two smaller pieces that
          // drift apart, then mark hasSplit so it won't re-fire.
          if (
            o.type === "obstacle" &&
            o.willSplit &&
            !o.hasSplit &&
            o.z < 250
          ) {
            o.hasSplit = true;
            const childSize = o.baseSize * 0.62;
            const childVx = 70 + Math.random() * 25;
            objectsRef.current.push({
              id: nextId++,
              type: "obstacle",
              x: o.x,
              y: o.y,
              z: o.z + 4,
              baseSize: childSize,
              hue: o.hue,
              vx: -childVx,
            });
            objectsRef.current.push({
              id: nextId++,
              type: "obstacle",
              x: o.x,
              y: o.y,
              z: o.z + 4,
              baseSize: childSize,
              hue: o.hue,
              vx: childVx,
            });
            // Remove the original; the two children replace it.
            objs.splice(i, 1);
            continue;
          }
          // Collision window slightly wider than before (was z<50). Objects move
          // fast at close range, so we start checking a bit earlier.
          if (!o.collected && o.z < 80) {
            // Project object to screen using the EXACT same formula as the renderer.
            const scale = FOCAL / o.z;
            const sx = cxNow + (o.x - planeWorldX * 0.4) * scale;
            const sy =
              planeAnchorYNow +
              (o.y - planeWorldY * 0.4) * scale -
              (1 - scale) * 80;
            const projectedSize = o.baseSize * scale;

            const dx = sx - planeScreenXNow;
            const dy = sy - planeScreenYNow;
            const distSq = dx * dx + dy * dy;
            // Near-miss tracking: for obstacles, sample the minimum
            // screen-space distance across every frame the obstacle is
            // inside the collision window. Latches at the closest pass
            // so we can score the bonus the moment the obstacle clears.
            if (o.type === "obstacle") {
              const dist = Math.sqrt(distSq);
              if (o.closestDist === undefined || dist < o.closestDist) {
                o.closestDist = dist;
              }
            }
            // Screen-space hit radii: tuned so visible overlap = collision.
            // Rings remain generous; obstacles must visually touch the sprite.
            const hitR =
              o.type === "ring"
                ? projectedSize * 0.45 + PLANE_SIZE * 0.35
                : o.type === "powerup"
                ? projectedSize * 0.5 + PLANE_SIZE * 0.35
                : projectedSize * 0.32 + PLANE_SIZE * 0.22;
            if (distSq < hitR * hitR) {
              if (o.type === "ring") {
                o.collected = true;
                collectedRingsRef.current += 1;
                // Bump combo, refresh its lapse timer, then award scaled points.
                comboRef.current += 1;
                if (comboRef.current > bestComboRef.current) {
                  bestComboRef.current = comboRef.current;
                }
                comboExpiresRef.current = now + 4000; // 4 s window
                const mult = Math.min(5, 1 + Math.floor(comboRef.current / 3));
                const gained = 50 * mult;
                scoreRef.current += gained;
                // Tier-up moment: only the coin that crosses a new multiplier
                // threshold (×2 at combo 3, ×3 at 6, ×4 at 9, ×5 at 12) fires
                // an extra popup, success haptic, and a 350 ms HUD scale flash.
                if (mult > comboTierRef.current) {
                  comboTierRef.current = mult;
                  scoreFlashUntilRef.current = now + 350;
                  popupsRef.current.push({
                    id: nextId++,
                    value: 0,
                    t: now,
                    label: `COMBO ×${mult}!`,
                  });
                  if (Platform.OS !== "web" && hapticsOn()) {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    ).catch(() => {});
                  }
                }
                popupsRef.current.push({
                  id: nextId++,
                  value: gained,
                  t: now,
                });
                // Coin-burst firework. 6 particles at ×1, scales with the
                // active multiplier so a ×5 grab puts ~30 sparks on screen.
                // Spawned at the projected collision point so the visual
                // ties to the coin the player just hit. Angles are a
                // pseudo-uniform fan plus a small jitter so they don't
                // look like a perfect wheel.
                const burstCount = 6 * mult;
                const baseAng = Math.random() * Math.PI * 2;
                for (let bi = 0; bi < burstCount; bi++) {
                  const ang =
                    baseAng +
                    (bi / burstCount) * Math.PI * 2 +
                    (Math.random() - 0.5) * 0.35;
                  const speed = 220 + Math.random() * 160; // px/sec
                  particlesRef.current.push({
                    id: nextId++,
                    x: sx,
                    y: sy,
                    vx: Math.cos(ang) * speed,
                    vy: Math.sin(ang) * speed,
                    t: now,
                    life: 250,
                    size: 4 + Math.random() * 3,
                    color: "#FDE047",
                  });
                }
                setCombo(comboRef.current);
                playSfx("ring", 0.5);
                if (Platform.OS !== "web" && hapticsOn()) {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                }
              } else if (o.type === "powerup" && o.powerup) {
                o.collected = true;
                const kind = o.powerup;
                if (kind === "shield") {
                  shieldRef.current = true;
                  setShieldActive(true);
                } else if (kind === "magnet") {
                  magnetUntilRef.current = now + POWERUP_DURATIONS.magnet;
                  setMagnetUntilHud(magnetUntilRef.current);
                } else if (kind === "slowmo") {
                  slowmoUntilRef.current = now + POWERUP_DURATIONS.slowmo;
                  setSlowmoUntilHud(slowmoUntilRef.current);
                }
                popupsRef.current.push({
                  id: nextId++,
                  value: 0,
                  t: now,
                  label: POWERUP_THEME[kind].label,
                });
                playSfx("boost", 0.5);
                if (Platform.OS !== "web" && hapticsOn()) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  ).catch(() => {});
                }
              } else {
                // Obstacle. If a shield is active, consume it and keep flying.
                if (shieldRef.current) {
                  shieldRef.current = false;
                  setShieldActive(false);
                  o.collected = true; // remove the obstacle that broke the shield
                  setCrashFlash(true);
                  setTimeout(() => setCrashFlash(false), 200);
                  if (Platform.OS !== "web" && hapticsOn()) {
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Heavy
                    ).catch(() => {});
                  }
                } else {
                  comboRef.current = 0;
                  comboExpiresRef.current = 0;
                  comboTierRef.current = 1;
                  setCombo(0);
                  setCrashFlash(true);
                  setTimeout(() => setCrashFlash(false), 280);
                  playSfx("crash", 0.7);
                  if (Platform.OS !== "web" && hapticsOn()) {
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Heavy
                    ).catch(() => {});
                  }
                  // Freeze + shake for a beat so the impact lands before the
                  // game-over overlay reads (research §1.1). endGame fires
                  // after the shake window.
                  crashingRef.current = true;
                  shakeUntilRef.current = now + 320;
                  setTimeout(() => {
                    crashingRef.current = false;
                    endGame();
                  }, 300);
                  break;
                }
              }
            }
            // Near-miss bonus: once the obstacle has slipped past the
            // plane's z plane without crashing, check whether the
            // closest screen-space approach was inside the bonus radius
            // (90 px from plane center). Shield-active grabs are excluded
            // because the shield path uses different geometry — clipping
            // a shielded obstacle is not a skill flex.
            if (
              o.type === "obstacle" &&
              !o.collected &&
              !o.passed &&
              o.z < 30
            ) {
              o.passed = true;
              if (
                !shieldRef.current &&
                o.closestDist !== undefined &&
                o.closestDist < 90
              ) {
                scoreRef.current += 25;
                popupsRef.current.push({
                  id: nextId++,
                  value: 0,
                  t: now,
                  label: "NEAR MISS +25",
                });
                if (Platform.OS !== "web" && hapticsOn()) {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                }
              }
            }
          }
        }

        setScore(Math.floor(scoreRef.current));
        // Only re-render the world when actually playing. While paused / on
        // overlays / game-over, an idle rAF still runs (so we can resume
        // cheaply) but skips React state updates.
        setTick((t) => (t + 1) % 1000000);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
    // The loop runs once for the lifetime of this screen and reads game state
    // through refs. Including endGame would tear down and recreate the loop
    // every render, which would lose frame timing and start the world over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch handlers
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (stateRef.current === "playing") {
          boostRef.current = true;
          setBoostActive(true);
          if (!wasBoostingRef.current) {
            boostsThisRunRef.current += 1;
            wasBoostingRef.current = true;
            playSfx("boost", 0.5);
          }
        }
      },
      onPanResponderMove: (_, g) => {
        if (stateRef.current === "playing" && g.dy > 60 && g.vy > 0.5) {
          boostRef.current = false;
          brakeRef.current = true;
          setBoostActive(false);
          setBrakeActive(true);
        }
      },
      onPanResponderRelease: () => {
        boostRef.current = false;
        brakeRef.current = false;
        setBoostActive(false);
        setBrakeActive(false);
      },
      onPanResponderTerminate: () => {
        boostRef.current = false;
        brakeRef.current = false;
        setBoostActive(false);
        setBrakeActive(false);
      },
    })
  ).current;

  // ---- Render
  const cx = SW / 2;
  // Anchor plane at ~62% of screen height (lower-center is the visual focus)
  const planeAnchorY = SH * 0.62;
  // Shimmer for skin animation: derived from the clock at render time so it
  // doesn't drive its own setState. The game loop already re-renders every
  // frame during play (via setTick), so the value updates smoothly without
  // any extra animation listener.
  const shimmerVal = (performance.now() % 3500) / 3500;
  // 0..1 sine used by the splitter render below to throb its warning
  // border. ~1.3 Hz cycle reads as "telegraphing" without being seizure-y.
  const splitterPulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
  // Score HUD scale flash on combo tier-up. Eases from 1.15 back to 1.00
  // across the 350 ms window so the pop doesn't snap, and naturally
  // returns to 1 once the timer expires (Math.max clamps the lerp).
  const scoreFlashRemain = Math.max(
    0,
    scoreFlashUntilRef.current - performance.now()
  );
  const scoreScale = 1 + 0.15 * (scoreFlashRemain / 350);
  // Environment phase-transition flash overlay opacity. Linear fade from
  // 0.45 at the moment of bucket change down to 0 at the 600 ms mark.
  const phaseFlashRemain = Math.max(
    0,
    phaseFlashUntilRef.current - performance.now()
  );
  const phaseFlashOpacity = 0.45 * (phaseFlashRemain / 600);
  // Crash screen-shake. Amplitude decays with the remaining shake time; the
  // per-frame random jitter (re-rendered every frame during the crash freeze)
  // reads as impact. Zero when not shaking, so it's a no-op the rest of the time.
  const shakeRemain = Math.max(0, shakeUntilRef.current - performance.now());
  const shakeAmp =
    shakeRemain > 0 && !reducedMotion ? (shakeRemain / 320) * 11 : 0;
  const shakeX = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
  const shakeY = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
  const planeWorldX =
    smoothTiltRef.current.roll * sensRef.current * PLANE_X_RANGE;
  const planeWorldY =
    -smoothTiltRef.current.pitch * sensRef.current * PLANE_Y_RANGE;
  const planeScreenX = cx + smoothTiltRef.current.roll * sensRef.current * 90;
  const planeScreenY =
    planeAnchorY + smoothTiltRef.current.pitch * sensRef.current * 70;

  const renderedObjects = objectsRef.current
    .filter((o) => !o.collected && o.z > 5 && o.z < FAR_Z)
    .map((o) => {
      const scale = FOCAL / o.z;
      const sx = cx + (o.x - planeWorldX * 0.4) * scale;
      const sy =
        planeAnchorY + (o.y - planeWorldY * 0.4) * scale - (1 - scale) * 80;
      const size = o.baseSize * scale;
      const opacity = Math.min(1, (FAR_Z - o.z) / 600);
      if (o.type === "ring") {
        // Subtle pulse 0..1 fed to the Coin (drives the inner highlight, not
        // the disc size — keeping size stable so hit-feel stays predictable).
        const pulse =
          0.5 + 0.5 * Math.sin(performance.now() / 260 + o.id * 0.7);
        // ScaleX-driven spin illusion. Compresses to 0.3 and expands back
        // to 1.0 on a ~1.3 s cycle — reads as a coin flipping edge-on and
        // face-on. Per-coin id phase so a wall of coins doesn't flip in
        // lockstep. Compressed at minimum but never inverted (negative
        // scaleX would flip the glyph backwards).
        const spinPhase = Math.cos(performance.now() / 480 + o.id * 0.7);
        const spin = 0.3 + 0.7 * (0.5 + 0.5 * spinPhase);
        // 0..1 glint phase — slower than spin, slightly offset per coin
        // so the bright spot doesn't track the spin in a way that reads
        // as one combined motion.
        const glint =
          0.5 + 0.5 * Math.sin(performance.now() / 700 + o.id * 1.3);
        return (
          <View
            key={o.id}
            style={{
              position: "absolute",
              left: sx - size / 2,
              top: sy - size / 2,
              width: size,
              height: size,
              pointerEvents: "none",
              transform: [{ scaleX: spin }],
            }}
          >
            <Coin
              size={size}
              pulse={pulse}
              glint={glint}
              opacity={0.6 + 0.4 * opacity}
            />
          </View>
        );
      }
      if (o.type === "powerup" && o.powerup) {
        const theme = POWERUP_THEME[o.powerup];
        const bob =
          Math.sin(performance.now() / 240 + o.id * 0.9) * (size * 0.06);
        return (
          <View
            key={o.id}
            style={[
              styles.powerupBox,
              {
                left: sx - size / 2,
                top: sy - size / 2 + bob,
                width: size,
                height: size,
                borderRadius: size * 0.22,
                backgroundColor: theme.color,
                opacity: 0.85 + 0.15 * opacity,
                pointerEvents: "none",
              },
            ]}
          >
            <Ionicons
              name={theme.icon as any}
              size={size * 0.55}
              color="#0F172A"
            />
          </View>
        );
      }
      const isPendingSplitter = o.willSplit && !o.hasSplit;
      // Pulse the yellow border alpha 0.45 -> 1.0 so it visibly throbs
      // before the obstacle breaks apart. Border width stays constant to
      // avoid per-frame layout work.
      const splitterBorderAlpha = 0.45 + 0.55 * splitterPulse;
      // Cross-bar geometry for the inner X marker on pending splitters.
      const barLen = size * 0.6;
      const barThick = Math.max(2, size * 0.06);
      // Lozenge variant rotates the whole tile 45° for silhouette
      // variety. Splitters always render upright so the orange + X
      // signal stays unambiguous.
      const isLozenge = !isPendingSplitter && o.variant === 2;
      const obstacleH = size * 0.85;
      const chevSize = size * 0.32;
      const warnSize = size * 0.5;
      return (
        <View
          key={o.id}
          style={[
            styles.obstacle,
            {
              left: sx - size / 2,
              top: sy - size / 2,
              width: size,
              height: obstacleH,
              borderRadius: size * 0.18,
              // Pending splitters get a hot orange fill so they pop
              // against the obstacle palette. Cleared splitters
              // (post-split children) fall back to the spawn-time hue.
              backgroundColor: isPendingSplitter ? "#FB923C" : o.hue,
              opacity: 0.55 + 0.45 * opacity,
              pointerEvents: "none",
              borderColor: isPendingSplitter
                ? `rgba(253, 224, 71, ${splitterBorderAlpha.toFixed(2)})`
                : "#0F172A",
              borderWidth: isPendingSplitter ? 3 : 2,
              transform: isLozenge ? [{ rotate: "45deg" }] : undefined,
            },
          ]}
        >
          {/* Weight stripe — dark band at the bottom 25 % gives every
              tile a sense of mass / 3D sit. Skipped on lozenges because
              their "bottom" rotates with the tile and becomes a corner. */}
          {!isLozenge && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: obstacleH * 0.25,
                backgroundColor: "rgba(15,23,42,0.3)",
                borderBottomLeftRadius: size * 0.18,
                borderBottomRightRadius: size * 0.18,
              }}
            />
          )}
          {/* Variant 0: two stacked chevron-downs. "Highway hazard"
              read — pulls the eye toward the bottom of the tile, which
              is the side closest to the player. */}
          {!isPendingSplitter && o.variant === 0 && (
            <>
              <Ionicons
                name="chevron-down"
                size={chevSize}
                color="rgba(255,255,255,0.9)"
                style={{
                  position: "absolute",
                  left: size / 2 - chevSize / 2,
                  top: obstacleH * 0.15,
                }}
              />
              <Ionicons
                name="chevron-down"
                size={chevSize}
                color="rgba(255,255,255,0.9)"
                style={{
                  position: "absolute",
                  left: size / 2 - chevSize / 2,
                  top: obstacleH * 0.45,
                }}
              />
            </>
          )}
          {/* Variant 1: centered warning glyph. Universal "this thing
              is dangerous" icon — no learning curve. */}
          {!isPendingSplitter && o.variant === 1 && (
            <Ionicons
              name="warning"
              size={warnSize}
              color="rgba(255,255,255,0.92)"
              style={{
                position: "absolute",
                left: size / 2 - warnSize / 2,
                top: obstacleH / 2 - warnSize / 2,
              }}
            />
          )}
          {isPendingSplitter && (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: (size - barLen) / 2,
                  top: (obstacleH - barThick) / 2,
                  width: barLen,
                  height: barThick,
                  backgroundColor: "#7C2D12",
                  borderRadius: barThick / 2,
                  transform: [{ rotate: "45deg" }],
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: (size - barLen) / 2,
                  top: (obstacleH - barThick) / 2,
                  width: barLen,
                  height: barThick,
                  backgroundColor: "#7C2D12",
                  borderRadius: barThick / 2,
                  transform: [{ rotate: "-45deg" }],
                }}
              />
            </>
          )}
        </View>
      );
    });

  const tiltX = smoothTiltRef.current.roll;
  const tiltY = smoothTiltRef.current.pitch;
  // Show the tilt helper crosshair only to newer players (first few runs of
  // their career). Veterans have internalized the controls and the always-on
  // indicator is just HUD noise (audit 2.8.5). Reuses existing crash count so
  // there's no new persisted state.
  const showTiltHelper = progress.totalCrashes < 3;
  const speedPct = Math.min(
    1,
    Math.max(0, (speedRef.current - BRAKE_SPEED) / (BOOST_SPEED - BRAKE_SPEED))
  );

  return (
    <View
      style={[
        styles.root,
        (shakeX !== 0 || shakeY !== 0) && {
          transform: [{ translateX: shakeX }, { translateY: shakeY }],
        },
      ]}
    >
      <LinearGradient
        colors={env.gradient}
        style={StyleSheet.absoluteFill}
      />

      {/* Distant horizon strip */}
      <View
        style={[
          styles.horizon,
          {
            top: SH * 0.55 + tiltY * 30,
            transform: [{ rotate: `${-tiltX * 6}deg` }],
          },
        ]}
      />

      <ParallaxClouds
        offset={cloudOffsetRef.current}
        tiltX={tiltX}
        tiltY={tiltY}
        SW={SW}
        SH={SH}
        cloudColor={env.cloud}
      />

      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {renderedObjects}
      </View>

      {boostActive && <BoostLines SW={SW} SH={SH} />}

      {/* Environment phase-transition flash overlay. Sits above the world
          and BoostLines so it tints them, but below popups + HUD so the
          banner text and score stay legible during the 600 ms window. */}
      {phaseFlashOpacity > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#FFFFFF", opacity: phaseFlashOpacity },
          ]}
        />
      )}

      {/* Coin-collect particles. Above the world + phase flash so they
          read on every background, below popups + HUD so they never
          obscure score text. Position is screen-space; the loop already
          advanced it this frame. */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {particlesRef.current.map((pt) => {
          const age = (performance.now() - pt.t) / pt.life;
          if (age >= 1) return null;
          return (
            <View
              key={pt.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: pt.x - pt.size / 2,
                top: pt.y - pt.size / 2,
                width: pt.size,
                height: pt.size,
                borderRadius: pt.size / 2,
                backgroundColor: pt.color,
                opacity: 1 - age,
              }}
            />
          );
        })}
      </View>

      {/* Score popups + powerup pickups */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {popupsRef.current.map((p) => {
          // Phase banner: own 600 ms life with fade-in / hold / fade-out.
          // Checked before the generic label branch so env transitions get
          // the dedicated treatment instead of the float-up powerup style.
          if (p.kind === "phase") {
            const elapsed = performance.now() - p.t;
            if (elapsed > 600) return null;
            const phaseOp =
              elapsed < 150
                ? elapsed / 150
                : elapsed > 400
                ? Math.max(0, (600 - elapsed) / 200)
                : 1;
            return (
              <Text
                key={p.id}
                style={[
                  styles.phasePopup,
                  {
                    left: SW / 2 - 160,
                    top: SH * 0.4,
                    opacity: phaseOp,
                  },
                ]}
              >
                {p.label}
              </Text>
            );
          }
          const age = (performance.now() - p.t) / 800;
          if (age > 1) return null;
          const opacity = 1 - age;
          const ty = -age * 70;
          if (p.label) {
            return (
              <Text
                key={p.id}
                style={[
                  styles.powerupPopup,
                  {
                    left: SW / 2 - 90,
                    top: SH * 0.55 + ty,
                    opacity,
                    transform: [{ scale: 1 + age * 0.4 }],
                  },
                ]}
              >
                {p.label}
              </Text>
            );
          }
          return (
            <Text
              key={p.id}
              style={[
                styles.scorePopup,
                {
                  left: SW / 2 - 30,
                  top: SH * 0.55 + ty,
                  opacity,
                  transform: [{ scale: 1 + age * 0.4 }],
                },
              ]}
            >
              +{p.value}
            </Text>
          );
        })}
      </View>

      {/* Plane (with white halo so it stays visible) */}
      <View
        style={[
          styles.planeWrap,
          {
            left: planeScreenX - PLANE_SIZE / 2,
            top: planeScreenY - PLANE_SIZE / 2,
            pointerEvents: "none",
          },
        ]}
      >
        <View style={styles.planeHalo} />
        <PaperPlane
          size={PLANE_SIZE}
          tilt={tiltX}
          pitch={-tiltY}
          skinId={progress.equippedSkin}
          shimmerPhase={shimmerVal}
          flameTick={(shimmerVal * 5) % 1}
        />
      </View>

      {/* Touch capture during play */}
      {state === "playing" && (
        <View
          style={StyleSheet.absoluteFill}
          {...panResponder.panHandlers}
          testID="touch-capture"
        />
      )}

      {/* Crash flash */}
      {crashFlash && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(252,165,165,0.55)",
              pointerEvents: "none",
            },
          ]}
        />
      )}

      {/* HUD */}
      <SafeAreaView
        style={[styles.hudSafe, { pointerEvents: "box-none" }]}
      >
        <View
          style={[styles.hudTop, { pointerEvents: "box-none" }]}
        >
          <View
            style={[
              styles.hudPill,
              { transform: [{ scale: scoreScale }] },
            ]}
            testID="score-display"
          >
            <Ionicons name="trophy" size={14} color="#0F172A" />
            <Text style={styles.hudText}>{score}</Text>
          </View>

          {showTiltHelper ? (
            <TiltIndicator tiltX={tiltX} tiltY={tiltY} />
          ) : (
            <View style={{ width: 44 }} />
          )}

          <View style={styles.hudPillCol} testID="speed-indicator">
            <Text style={styles.hudLabel}>SPEED</Text>
            <View style={styles.speedBarTrack}>
              <View
                style={[
                  styles.speedBarFill,
                  {
                    width: `${speedPct * 100}%`,
                    backgroundColor: boostActive
                      ? "#FDE047"
                      : brakeActive
                      ? "#FCA5A5"
                      : "#0F172A",
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {state === "playing" && combo >= 2 && (
          <View style={styles.comboWrap} testID="combo-indicator">
            <View
              style={[
                styles.comboPill,
                combo >= 12 && styles.comboPillHot,
                combo >= 6 && combo < 12 && styles.comboPillWarm,
              ]}
            >
              <Ionicons name="flame" size={14} color="#0F172A" />
              <Text style={styles.comboNum}>{combo}</Text>
              <Text style={styles.comboMult}>
                x{Math.min(5, 1 + Math.floor(combo / 3))}
              </Text>
            </View>
          </View>
        )}

        {state === "playing" && (
          <PowerupHud
            shieldActive={shieldActive}
            magnetUntil={magnetUntilHud}
            slowmoUntil={slowmoUntilHud}
          />
        )}

        {state === "playing" && (
          <View
            style={[styles.cornerBtns, { pointerEvents: "box-none" }]}
          >
            <TouchableOpacity
              onPress={() => {
                setState("paused");
                stateRef.current = "paused";
              }}
              style={styles.iconBtn}
              testID="pause-button"
            >
              <Ionicons name="pause" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {boostActive && (
        <View
          style={[styles.boostBadge, { left: SW / 2 - 60 }]}
          testID="boost-active"
        >
          <Ionicons name="flash" size={14} color="#0F172A" />
          <Text style={styles.boostText}>BOOST</Text>
        </View>
      )}

      {noSensor && (
        <Overlay SW={SW}>
          <View style={styles.noSensorIcon}>
            <Ionicons name="phone-portrait-outline" size={32} color="#0F172A" />
          </View>
          <Text style={styles.overlayEyebrow}>NO TILT SENSOR</Text>
          <Text style={styles.overlayTitle}>Open on your phone</Text>
          <Text style={styles.overlaySub}>
            Paper Fly uses your phone&apos;s tilt sensor to steer. We
            can&apos;t detect one here — try opening this on an iOS or
            Android device.
          </Text>
          <View
            style={{
              backgroundColor: "rgba(181,255,252,0.45)",
              borderColor: "#0F172A",
              borderWidth: 2,
              borderRadius: 12,
              padding: 12,
              marginTop: 6,
              marginBottom: 14,
            }}
          >
            <Text style={styles.noSensorTip}>
              On iOS Safari you may need to grant Motion &amp; Orientation
              permission in your phone&apos;s Settings → Safari.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => router.replace("/")}
            testID="no-sensor-home"
          >
            <Ionicons name="home-outline" size={18} color="#0F172A" />
            <Text style={styles.ghostBtnText}>Back to menu</Text>
          </TouchableOpacity>
        </Overlay>
      )}

      {state === "ready" && !noSensor && launchCountdown === null && (
        <Overlay SW={SW}>
          <Text style={styles.overlayTitle}>Ready?</Text>
          <Text style={styles.overlaySub}>
            Tilt to steer · Hold screen to boost
          </Text>
          <View
            style={{
              backgroundColor: "rgba(181,255,252,0.45)",
              borderColor: "#0F172A",
              borderWidth: 2,
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: "#0F172A",
                fontWeight: "700",
                textAlign: "center",
                lineHeight: 17,
              }}
            >
              Tip: tap{" "}
              <Text style={{ fontWeight: "900" }}>Calibrate</Text> first while
              holding the phone in your natural pose.
            </Text>
          </View>
          <View style={styles.overlayBtnRow}>
            <GameButton
              label="FLY"
              icon="play"
              variant="primary"
              size="md"
              flex
              onPress={beginLaunch}
              testID="ready-start-button"
            />
            <GameButton
              label="Calibrate"
              icon="compass-outline"
              variant="secondary"
              size="md"
              flex
              onPress={doCalibrate}
              testID="calibrate-button"
            />
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 18 }}
            testID="ready-back"
          >
            <Text style={styles.linkText}>← Back to menu</Text>
          </TouchableOpacity>
        </Overlay>
      )}

      {launchCountdown !== null && (
        <View style={[styles.calibrationOverlay, { pointerEvents: "none" }]}>
          <Text style={styles.launchCount}>
            {launchCountdown > 0 ? launchCountdown : "GO!"}
          </Text>
        </View>
      )}

      {calibrating && (
        <View
          style={[styles.calibrationOverlay, { pointerEvents: "none" }]}
        >
          <Text style={styles.calibrationText}>HOLD STEADY</Text>
          <Text style={styles.calibrationCount}>{calibCountdown}</Text>
          <Text style={styles.calibrationHint}>
            Hold the phone in your natural play pose
          </Text>
          <Text style={styles.calibrationHintSmall}>
            This becomes your new neutral
          </Text>
        </View>
      )}

      {state === "paused" && (
        <Overlay SW={SW}>
          <Text style={styles.overlayTitle}>Paused</Text>
          <View style={styles.overlayBtnRow}>
            <GameButton
              label="RESUME"
              icon="play"
              variant="primary"
              size="md"
              flex
              onPress={() => {
                setState("playing");
                stateRef.current = "playing";
                lastFrameRef.current = performance.now();
              }}
              testID="resume-button"
            />
            <GameButton
              label="Quit"
              icon="home-outline"
              variant="secondary"
              size="md"
              flex
              onPress={confirmQuit}
              testID="quit-button"
            />
          </View>
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay SW={SW}>
          {runResult?.newBestScore && !reducedMotion && (
            <Confetti width={SW - 60} trigger={gameOverNonce} />
          )}
          {isDaily && (
            <View style={styles.dailyTag}>
              <Ionicons name="calendar" size={11} color="#0F172A" />
              <Text style={styles.dailyTagText}>
                DAILY · {todaySeedString()}
              </Text>
            </View>
          )}
          <Text style={styles.overlayEyebrow}>
            {runResult?.newBestScore ? "★ NEW BEST ★" : "CRASHED"}
          </Text>
          <Text style={styles.overlayTitle}>
            {runResult?.newBestScore ? "New Record!" : "Game Over"}
          </Text>
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statBox,
                runResult?.newBestScore && styles.statBoxBest,
              ]}
            >
              <Text style={styles.statLabel}>SCORE</Text>
              <Text
                style={[
                  styles.statValue,
                  runResult?.newBestScore && styles.statValueBest,
                ]}
              >
                {countScore}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>COINS</Text>
              <Text style={styles.statValue}>{collectedRingsRef.current}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>COMBO</Text>
              <Text style={styles.statValue}>×{bestComboRef.current}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BEST</Text>
              <Text style={styles.statValue}>{progress.bestScore}</Text>
            </View>
          </View>

          {/* Diff chips — frame the run against the player's own history,
              which is what drives the retry (research §2.3 / audit 2.4.2). */}
          {runSnapshot &&
            (() => {
              const chips: { key: string; text: string; good?: boolean }[] = [];
              const vsBest = runSnapshot.score - runSnapshot.prevBest;
              if (runResult?.newBestScore && runSnapshot.prevBest > 0) {
                chips.push({
                  key: "best",
                  text: `+${vsBest} over your old best`,
                  good: true,
                });
              } else if (!runResult?.newBestScore && runSnapshot.prevBest > 0) {
                chips.push({
                  key: "best",
                  text: `${runSnapshot.prevBest - runSnapshot.score} to beat your best`,
                });
              }
              if (
                runSnapshot.seconds > runSnapshot.prevLongest &&
                runSnapshot.seconds > 0
              ) {
                chips.push({
                  key: "long",
                  text: `Longest flight yet · ${runSnapshot.seconds}s`,
                  good: true,
                });
              }
              if (chips.length === 0) return null;
              return (
                <View style={styles.diffRow}>
                  {chips.map((c) => (
                    <View
                      key={c.key}
                      style={[styles.diffChip, c.good && styles.diffChipGood]}
                    >
                      <Text style={styles.diffChipText}>{c.text}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

          {runResult && (
            <View style={styles.rewardBlock} testID="reward-block">
              <Reveal delay={1250} trigger={gameOverNonce}>
                <View style={styles.xpBadge}>
                  <Ionicons name="star" size={14} color="#0F172A" />
                  <Text style={styles.xpBadgeText}>
                    +{runResult.xpGained} XP
                  </Text>
                </View>
              </Reveal>
              {runResult.leveledUp && (
                <Reveal delay={1450} trigger={gameOverNonce}>
                  <View style={styles.unlockPill}>
                    <Ionicons name="arrow-up-circle" size={15} color="#0F172A" />
                    <Text style={styles.unlockText}>
                      Level Up → {runResult.newLevel}!
                    </Text>
                  </View>
                </Reveal>
              )}
              {[
                ...runResult.unlockedSkinsByLevel,
                ...runResult.unlockedSkinsByAchievement,
              ].map((id, i) => (
                <Reveal
                  key={`skin-${id}`}
                  delay={1650 + i * 220}
                  trigger={gameOverNonce}
                >
                  <View style={[styles.unlockPill, styles.unlockPillSkin]}>
                    <Ionicons name="sparkles" size={15} color="#0F172A" />
                    <Text style={styles.unlockText}>
                      Skin Unlocked: {SKINS[id].name}
                    </Text>
                  </View>
                </Reveal>
              ))}
              {runResult.unlockedAchievements
                .filter(
                  (a) =>
                    !runResult.unlockedSkinsByAchievement.some(
                      (sid) => SKIN_BY_ACHIEVEMENT[sid] === a
                    )
                )
                .map((a, i) => (
                  <Reveal
                    key={`ach-${a}`}
                    delay={1850 + i * 220}
                    trigger={gameOverNonce}
                  >
                    <View style={styles.unlockPill}>
                      <Ionicons name="trophy" size={15} color="#0F172A" />
                      <Text style={styles.unlockText}>
                        Achievement: {ACHIEVEMENTS[a].name}
                      </Text>
                    </View>
                  </Reveal>
                ))}
            </View>
          )}

          <View style={styles.overlayBtnRow}>
            <GameButton
              label="RETRY"
              icon="refresh"
              variant="primary"
              size="md"
              flex
              pulse={retryPulse}
              onPress={startGame}
              testID="restart-button"
            />
            <GameButton
              label="Share"
              icon="share-social-outline"
              variant="secondary"
              size="md"
              flex
              onPress={shareScore}
              testID="share-score-button"
            />
            <GameButton
              label="Home"
              icon="home-outline"
              variant="secondary"
              size="md"
              flex
              onPress={() => router.replace("/")}
              testID="home-button"
            />
          </View>

          {runResult &&
            runResult.unlockedSkinsByLevel.length +
              runResult.unlockedSkinsByAchievement.length >
              0 && (
              <View style={{ marginTop: 10 }}>
                <GameButton
                  label="View New Skin"
                  icon="shirt"
                  variant="cyan"
                  size="md"
                  onPress={() => router.replace("/skins")}
                  testID="view-skin-button"
                />
              </View>
            )}
        </Overlay>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFDEE9", overflow: "hidden" },
  horizon: {
    position: "absolute",
    left: -60,
    right: -60,
    height: 4,
    backgroundColor: "rgba(15,23,42,0.18)",
  },
  scorePopup: {
    position: "absolute",
    width: 60,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    color: "#FDE047",
  },
  powerupPopup: {
    position: "absolute",
    width: 180,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#FFFFFF",
    textShadowColor: "rgba(15,23,42,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  phasePopup: {
    position: "absolute",
    width: 320,
    textAlign: "center",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 5,
    color: "#FFFFFF",
    textShadowColor: "rgba(15,23,42,0.75)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  powerupBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardBlock: {
    backgroundColor: "rgba(253,224,71,0.35)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  xpBadgeText: {
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1,
    fontSize: 13,
  },
  unlockText: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 13,
    textAlign: "center",
  },
  dailyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#A5F3FC",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  dailyTagText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1.5,
  },
  ghostBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  planeWrap: {
    position: "absolute",
    width: PLANE_SIZE,
    height: PLANE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  planeHalo: {
    position: "absolute",
    width: PLANE_SIZE * 1.6,
    height: PLANE_SIZE * 1.6,
    borderRadius: PLANE_SIZE,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  obstacle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  hudSafe: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  hudTop: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
  },
  hudPillCol: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    width: 110,
    gap: 4,
  },
  hudText: { fontWeight: "900", fontSize: 16, color: "#0F172A" },
  comboWrap: {
    alignItems: "center",
    marginTop: 8,
  },
  comboPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
  },
  comboPillWarm: {
    backgroundColor: "#FBA5C5",
  },
  comboPillHot: {
    backgroundColor: "#FDE047",
  },
  comboNum: {
    fontWeight: "900",
    fontSize: 14,
    color: "#0F172A",
  },
  comboMult: {
    fontWeight: "900",
    fontSize: 12,
    color: "#0F172A",
    opacity: 0.7,
    letterSpacing: 1,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#0F172A",
    opacity: 0.7,
  },
  speedBarTrack: {
    height: 8,
    backgroundColor: "rgba(15,23,42,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },
  speedBarFill: { height: "100%" },
  cornerBtns: {
    position: "absolute",
    right: 16,
    bottom: 30,
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  boostBadge: {
    position: "absolute",
    bottom: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
  },
  boostText: { fontWeight: "900", color: "#0F172A", letterSpacing: 1 },
  overlayEyebrow: {
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "800",
    color: "#FCA5A5",
    marginBottom: 6,
  },
  overlayTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1,
    marginBottom: 6,
  },
  overlaySub: {
    fontSize: 14,
    color: "#0F172A",
    opacity: 0.7,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
  },
  overlayBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE047",
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 16,
    letterSpacing: 1,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  ghostBtnText: { fontWeight: "800", color: "#0F172A", fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  statBox: {
    backgroundColor: "rgba(181,255,252,0.45)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  statBoxBest: {
    backgroundColor: "#FDE047",
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.7,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  statValueBest: { color: "#0F172A" },
  diffRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  diffChip: {
    backgroundColor: "rgba(15,23,42,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  diffChipGood: {
    backgroundColor: "rgba(34,197,94,0.22)",
  },
  diffChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
  },
  unlockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 2,
  },
  unlockPillSkin: {
    backgroundColor: "#C4B5FD",
  },
  linkText: {
    color: "#0F172A",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  calibrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  calibrationText: {
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  calibrationCount: {
    fontSize: 110,
    fontWeight: "900",
    color: "#0F172A",
  },
  launchCount: {
    fontSize: 130,
    fontWeight: "900",
    color: "#FDE047",
    letterSpacing: -2,
    textShadowColor: "rgba(15,23,42,0.7)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  calibrationHint: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 14,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  calibrationHintSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A",
    opacity: 0.65,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  noSensorIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0F172A",
    backgroundColor: "#FDE047",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noSensorTip: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 17,
  },
});
