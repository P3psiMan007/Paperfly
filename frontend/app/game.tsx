import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  PanResponder,
  Platform,
  Animated,
  Easing,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import * as Haptics from "expo-haptics";
import PaperPlane from "../src/PaperPlane";
import Cloud from "../src/Cloud";
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

// Map of which skins unlock from which achievement (kept here to avoid circular imports)
const SKIN_BY_ACHIEVEMENT: Partial<Record<SkinId, AchievementId>> = {
  mint: "rings_25",
};
const SKINS_BY_LEVEL: { id: SkinId; level: number }[] = [
  { id: "skyblue", level: 3 },
  { id: "crimson", level: 8 },
];

// World/projection constants
const FOCAL = 320;
const FAR_Z = 1100;
const SPAWN_Z = 1000;
const PLANE_SIZE = 76;
const BASE_SPEED = 380;
const BOOST_SPEED = 680;
const BRAKE_SPEED = 180;
const PLANE_X_RANGE = 220;
const PLANE_Y_RANGE = 170;

type WorldObj = {
  id: number;
  type: "ring" | "obstacle";
  x: number;
  y: number;
  z: number;
  baseSize: number;
  collected?: boolean;
  hue?: string;
};

type GameState = "ready" | "playing" | "paused" | "gameover";

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
  const [boostActive, setBoostActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState(3);
  const [shimmerVal, setShimmerVal] = useState(0);
  const shimmerAnim = useMemo(() => new Animated.Value(0), []);

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
  const calibTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [, setTick] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  const popupsRef = useRef<{ id: number; value: number; t: number }[]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    loadSensitivity().then((s) => (sensRef.current = s));
    loadCalibration().then((c) => (calibRef.current = c));
    loadProgress().then(setProgress);
    // Shimmer for skin animation
    const id = shimmerAnim.addListener(({ value }) => setShimmerVal(value));
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      shimmerAnim.removeListener(id);
    };
  }, [shimmerAnim]);

  // Sensor subscription — prefer DeviceMotion (gravity-compensated, more stable)
  // and only fall back to Accelerometer if DeviceMotion is unavailable.
  // This avoids both sensors writing into the same ref and fighting each other.
  useEffect(() => {
    let accelSub: any = null;
    let dmSub: any = null;
    let cancelled = false;

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
            const r = data?.rotation;
            if (r) {
              const roll = Math.max(-1, Math.min(1, (r.gamma || 0) / 0.7));
              const pitch = Math.max(-1, Math.min(1, (r.beta || 0) / 0.7));
              rawTiltRef.current = { roll, pitch };
            }
          });
          return;
        } catch {}
      }

      // Fallback: accelerometer
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (!cancelled && ok) {
          Accelerometer.setUpdateInterval(33);
          accelSub = Accelerometer.addListener(({ x, y }) => {
            rawTiltRef.current = { roll: x, pitch: y };
          });
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
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
    setCalibrating(true);
    setCalibCountdown(3);
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
        const cur = rawTiltRef.current;
        calibRef.current = { pitch: cur.pitch, roll: cur.roll };
        saveCalibration(calibRef.current);
        setCalibrating(false);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
      }
    }, 700);
  };

  // Cleanup calibration timer on unmount
  useEffect(() => {
    return () => {
      if (calibTimerRef.current) {
        clearInterval(calibTimerRef.current);
        calibTimerRef.current = null;
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
    setRunResult(null);
    // Reset daily RNG so the same daily is reproducible per attempt
    dailyRngRef.current = isDaily ? mulberry32(todaySeed()) : null;
  };

  const startGame = () => {
    resetWorld();
    setState("playing");
    stateRef.current = "playing";
  };

  const endGame = async () => {
    setState("gameover");
    stateRef.current = "gameover";
    if (Platform.OS !== "web") {
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
      await saveProgress(next);
      setProgress(next);
      setRunResult(result);
    } catch (e) {
      console.warn("apply run failed", e);
    }
  };

  const shareScore = async () => {
    const finalScore = Math.floor(scoreRef.current);
    const tag = isDaily
      ? `Daily Challenge ${todaySeedString()}`
      : "Mr. Maybe Flight";
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

      if (stateRef.current === "playing") {
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

        scoreRef.current += dt * (speedRef.current / BASE_SPEED) * 10;

        cloudOffsetRef.current =
          (cloudOffsetRef.current + speedRef.current * dt * 0.4) % 1000;

        // Cleanup old score popups (>1s)
        if (popupsRef.current.length) {
          popupsRef.current = popupsRef.current.filter(
            (p) => now - p.t < 1000
          );
        }

        lastSpawnRef.current += dt;
        if (lastSpawnRef.current >= 0.55) {
          lastSpawnRef.current = 0;
          const rand = dailyRngRef.current ? dailyRngRef.current : Math.random;
          const isRing = rand() < 0.6;
          objectsRef.current.push({
            id: nextId++,
            type: isRing ? "ring" : "obstacle",
            x: (rand() - 0.5) * PLANE_X_RANGE * 2.4,
            y: (rand() - 0.5) * PLANE_Y_RANGE * 2.0,
            z: SPAWN_Z + rand() * 100,
            baseSize: isRing ? 55 : 70 + rand() * 30,
            hue: isRing ? "#FDE047" : rand() < 0.5 ? "#FCA5A5" : "#FBA5C5",
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

        const objs = objectsRef.current;
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i];
          o.z -= speedRef.current * dt;
          if (o.z <= 5) {
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
            // Screen-space hit radii: tuned so visible overlap = collision.
            // Rings remain generous; obstacles must visually touch the sprite.
            const hitR =
              o.type === "ring"
                ? projectedSize * 0.45 + PLANE_SIZE * 0.35
                : projectedSize * 0.32 + PLANE_SIZE * 0.22;
            if (distSq < hitR * hitR) {
              if (o.type === "ring") {
                o.collected = true;
                collectedRingsRef.current += 1;
                scoreRef.current += 50;
                popupsRef.current.push({
                  id: nextId++,
                  value: 50,
                  t: now,
                });
                playSfx("ring", 0.5);
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Light
                  ).catch(() => {});
                }
              } else {
                setCrashFlash(true);
                setTimeout(() => setCrashFlash(false), 280);
                playSfx("crash", 0.7);
                endGame();
                break;
              }
            }
          }
        }

        setScore(Math.floor(scoreRef.current));
      }

      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
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
        const pulse = 1 + Math.sin(performance.now() / 220 + o.id) * 0.06;
        const rsize = size * pulse;
        return (
          <View
            key={o.id}
            style={[
              styles.ring,
              {
                left: sx - rsize / 2,
                top: sy - rsize / 2,
                width: rsize,
                height: rsize,
                borderRadius: rsize / 2,
                borderWidth: Math.max(3, rsize * 0.18),
                borderColor: o.hue,
                opacity: 0.55 + 0.45 * opacity,
                pointerEvents: "none",
              },
            ]}
          />
        );
      }
      return (
        <View
          key={o.id}
          style={[
            styles.obstacle,
            {
              left: sx - size / 2,
              top: sy - size / 2,
              width: size,
              height: size * 0.85,
              borderRadius: size * 0.18,
              backgroundColor: o.hue,
              opacity: 0.55 + 0.45 * opacity,
              pointerEvents: "none",
            },
          ]}
        />
      );
    });

  const tiltX = smoothTiltRef.current.roll;
  const tiltY = smoothTiltRef.current.pitch;
  const speedPct = Math.min(
    1,
    Math.max(0, (speedRef.current - BRAKE_SPEED) / (BOOST_SPEED - BRAKE_SPEED))
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#FFDEE9", "#FFE3B5", "#B5FFFC"]}
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
      />

      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {renderedObjects}
      </View>

      {boostActive && <BoostLines SW={SW} SH={SH} />}

      {/* Score popups */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {popupsRef.current.map((p) => {
          const age = (performance.now() - p.t) / 800;
          if (age > 1) return null;
          const opacity = 1 - age;
          const ty = -age * 70;
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
          <View style={styles.hudPill} testID="score-display">
            <Ionicons name="trophy" size={14} color="#0F172A" />
            <Text style={styles.hudText}>{score}</Text>
          </View>

          <TiltIndicator tiltX={tiltX} tiltY={tiltY} />

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

      {state === "ready" && (
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
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={startGame}
              testID="ready-start-button"
            >
              <Ionicons name="play" size={18} color="#0F172A" />
              <Text style={styles.primaryBtnText}>FLY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={doCalibrate}
              testID="calibrate-button"
            >
              <Ionicons name="compass-outline" size={18} color="#0F172A" />
              <Text style={styles.ghostBtnText}>Calibrate</Text>
            </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setState("playing");
                stateRef.current = "playing";
                lastFrameRef.current = performance.now();
              }}
              testID="resume-button"
            >
              <Ionicons name="play" size={18} color="#0F172A" />
              <Text style={styles.primaryBtnText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.replace("/")}
              testID="quit-button"
            >
              <Ionicons name="home-outline" size={18} color="#0F172A" />
              <Text style={styles.ghostBtnText}>Quit</Text>
            </TouchableOpacity>
          </View>
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay SW={SW}>
          {isDaily && (
            <View style={styles.dailyTag}>
              <Ionicons name="calendar" size={11} color="#0F172A" />
              <Text style={styles.dailyTagText}>
                DAILY · {todaySeedString()}
              </Text>
            </View>
          )}
          <Text style={styles.overlayEyebrow}>CRASHED</Text>
          <Text style={styles.overlayTitle}>Game Over</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SCORE</Text>
              <Text style={styles.statValue}>{score}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>RINGS</Text>
              <Text style={styles.statValue}>{collectedRingsRef.current}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BEST</Text>
              <Text style={styles.statValue}>{progress.bestScore}</Text>
            </View>
          </View>

          {runResult && (
            <View style={styles.rewardBlock} testID="reward-block">
              <View style={styles.xpBadge}>
                <Ionicons name="star" size={14} color="#0F172A" />
                <Text style={styles.xpBadgeText}>
                  +{runResult.xpGained} XP
                </Text>
              </View>
              {runResult.leveledUp && (
                <Text style={styles.unlockText}>
                  Level Up → {runResult.newLevel}!
                </Text>
              )}
              {runResult.unlockedSkinsByLevel.map((id) => (
                <Text key={`l-${id}`} style={styles.unlockText}>
                  Skin Unlocked: {SKINS[id].name}
                </Text>
              ))}
              {runResult.unlockedSkinsByAchievement.map((id) => (
                <Text key={`a-${id}`} style={styles.unlockText}>
                  Skin Unlocked: {SKINS[id].name}
                </Text>
              ))}
              {runResult.unlockedAchievements
                .filter(
                  (a) =>
                    !runResult.unlockedSkinsByAchievement.some(
                      (sid) => SKIN_BY_ACHIEVEMENT[sid] === a
                    )
                )
                .map((a) => (
                  <Text key={`ach-${a}`} style={styles.unlockText}>
                    Achievement: {ACHIEVEMENTS[a].name}
                  </Text>
                ))}
              {runResult.newBestScore && (
                <Text style={[styles.unlockText, { color: "#B91C1C" }]}>
                  New Best Score!
                </Text>
              )}
            </View>
          )}

          <View style={styles.overlayBtnRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={startGame}
              testID="restart-button"
            >
              <Ionicons name="refresh" size={18} color="#0F172A" />
              <Text style={styles.primaryBtnText}>RETRY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={shareScore}
              testID="share-score-button"
            >
              <Ionicons name="share-social-outline" size={18} color="#0F172A" />
              <Text style={styles.ghostBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.replace("/")}
              testID="home-button"
            >
              <Ionicons name="home-outline" size={18} color="#0F172A" />
              <Text style={styles.ghostBtnText}>Home</Text>
            </TouchableOpacity>
          </View>
        </Overlay>
      )}
    </View>
  );
}

function Overlay({
  children,
  SW,
}: {
  children: React.ReactNode;
  SW: number;
}) {
  return (
    <View style={[styles.overlayWrap, { pointerEvents: "box-none" }]}>
      <View style={[styles.overlayPanel, { width: SW - 60 }]}>{children}</View>
    </View>
  );
}

function TiltIndicator({ tiltX, tiltY }: { tiltX: number; tiltY: number }) {
  const dotX = 22 + tiltX * 18;
  const dotY = 22 + tiltY * 18;
  return (
    <View style={styles.tiltIndicator} testID="tilt-indicator">
      <View style={styles.tiltCross} />
      <View style={styles.tiltCrossV} />
      <View style={[styles.tiltDot, { left: dotX - 6, top: dotY - 6 }]} />
    </View>
  );
}

function BoostLines({ SW, SH }: { SW: number; SH: number }) {
  const lines = Array.from({ length: 10 });
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {lines.map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const top = 60 + ((i * 73) % (SH - 200));
        return (
          <View
            key={i}
            style={[
              styles.boostLine,
              {
                top,
                left: side === -1 ? 10 : SW - 90,
                opacity: 0.55,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function ParallaxClouds({
  offset,
  tiltX,
  tiltY,
  SW,
  SH,
}: {
  offset: number;
  tiltX: number;
  tiltY: number;
  SW: number;
  SH: number;
}) {
  const layers = [
    { speed: 0.4, y: SH * 0.15, size: 110, count: 4, opacity: 0.55 },
    { speed: 0.7, y: SH * 0.32, size: 80, count: 5, opacity: 0.7 },
    { speed: 1.0, y: SH * 0.78, size: 130, count: 3, opacity: 0.8 },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {layers.map((layer, li) =>
        Array.from({ length: layer.count }).map((_, i) => {
          const spacing = SW / layer.count + 80;
          const baseX =
            i * spacing - ((offset * layer.speed) % (SW + 200)) - 100;
          const x = baseX - tiltX * 30 * layer.speed;
          const y = layer.y - tiltY * 20 * layer.speed;
          return (
            <View
              key={`${li}-${i}`}
              style={[
                styles.cloud,
                {
                  width: layer.size,
                  height: layer.size * 0.45,
                  borderRadius: layer.size,
                  left:
                    ((x % (SW + 200)) + (SW + 200)) % (SW + 200) - 100,
                  top: y,
                  opacity: layer.opacity,
                },
              ]}
            />
          );
        })
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
  cloud: { position: "absolute", backgroundColor: "#FFFFFF" },
  scorePopup: {
    position: "absolute",
    width: 60,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    color: "#FDE047",
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
  ring: { position: "absolute", backgroundColor: "transparent" },
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
  tiltIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tiltCross: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  tiltCrossV: {
    position: "absolute",
    height: "70%",
    width: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  tiltDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FDE047",
    borderWidth: 1.5,
    borderColor: "#0F172A",
  },
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
  boostLine: {
    position: "absolute",
    width: 80,
    height: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.25)",
  },
  overlayPanel: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
  },
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
    minWidth: 78,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.7,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
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
});
