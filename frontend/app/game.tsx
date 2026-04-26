import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  PanResponder,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import * as Haptics from "expo-haptics";
import PaperPlane from "../src/PaperPlane";
import {
  loadCalibration,
  saveCalibration,
  loadSensitivity,
  loadHighScore,
  saveHighScore,
  Calibration,
} from "../src/storage";

const { width: SW, height: SH } = Dimensions.get("window");

// World/projection constants
const FOCAL = 320;
const FAR_Z = 1100;
const SPAWN_Z = 1000;
const PLANE_SIZE = 80;
const BASE_SPEED = 380; // world units per second
const BOOST_SPEED = 680;
const BRAKE_SPEED = 180;
const PLANE_X_RANGE = 220; // max world-x offset from tilt
const PLANE_Y_RANGE = 170; // max world-y offset from tilt

type WorldObj = {
  id: number;
  type: "ring" | "obstacle";
  x: number;
  y: number;
  z: number;
  baseSize: number; // world-units radius
  collected?: boolean;
  hue?: string;
};

type GameState = "ready" | "playing" | "paused" | "gameover";

let nextId = 1;

export default function Game() {
  const router = useRouter();
  const params = useLocalSearchParams<{ calibrate?: string }>();

  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [boostActive, setBoostActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState(3);

  // Refs for high-frequency updates
  const sensRef = useRef(1.0);
  const calibRef = useRef<Calibration>({ pitch: 0, roll: 0 });
  const rawTiltRef = useRef({ pitch: 0, roll: 0 }); // last raw reading
  const smoothTiltRef = useRef({ pitch: 0, roll: 0 }); // filtered tilt -1..1
  const objectsRef = useRef<WorldObj[]>([]);
  const lastFrameRef = useRef(performance.now());
  const lastSpawnRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const boostRef = useRef(false);
  const brakeRef = useRef(false);
  const stateRef = useRef<GameState>("ready");
  const scoreRef = useRef(0);
  const collectedRingsRef = useRef(0);
  const ringScoreFlashRef = useRef<{ x: number; y: number; t: number } | null>(
    null
  );
  const cloudOffsetRef = useRef(0);
  const horizonOffsetRef = useRef(0);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load preferences
  useEffect(() => {
    loadSensitivity().then((s) => (sensRef.current = s));
    loadCalibration().then((c) => (calibRef.current = c));
    loadHighScore().then(setHighScore);
  }, []);

  // Sensor subscription with smoothing
  useEffect(() => {
    let accelSub: any = null;
    let dmSub: any = null;

    Accelerometer.setUpdateInterval(16);
    accelSub = Accelerometer.addListener(({ x, y }) => {
      // x: roll (-1..1), y: pitch
      rawTiltRef.current = { roll: x, pitch: y };
    });

    // Try DeviceMotion as well (more accurate on real devices)
    if (DeviceMotion && DeviceMotion.isAvailableAsync) {
      DeviceMotion.isAvailableAsync()
        .then((ok) => {
          if (!ok) return;
          DeviceMotion.setUpdateInterval(16);
          dmSub = DeviceMotion.addListener((data) => {
            const r = data.rotation;
            if (r) {
              // beta = pitch [-pi..pi], gamma = roll [-pi/2..pi/2]
              const roll = Math.max(-1, Math.min(1, (r.gamma || 0) / 0.7));
              const pitch = Math.max(-1, Math.min(1, (r.beta || 0) / 0.7));
              rawTiltRef.current = { roll, pitch };
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      if (accelSub) accelSub.remove();
      if (dmSub) dmSub.remove();
    };
  }, []);

  // Refresh sensitivity & calibration on focus (changed from settings)
  useFocusEffect(
    useCallback(() => {
      loadSensitivity().then((s) => (sensRef.current = s));
      loadCalibration().then((c) => (calibRef.current = c));
      loadHighScore().then(setHighScore);
    }, [])
  );

  // Auto-calibrate if requested via params
  useEffect(() => {
    if (params.calibrate === "1" && state === "ready") {
      setTimeout(() => doCalibrate(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.calibrate]);

  const doCalibrate = () => {
    setCalibrating(true);
    setCalibCountdown(3);
    let n = 3;
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCalibCountdown(n);
      } else {
        clearInterval(timer);
        const cur = rawTiltRef.current;
        calibRef.current = { pitch: cur.pitch, roll: cur.roll };
        saveCalibration(calibRef.current);
        setCalibrating(false);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }, 700);
  };

  // Reset world
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const finalScore = Math.floor(scoreRef.current);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      await saveHighScore(finalScore);
    }
  };

  // Game loop
  useEffect(() => {
    let raf: any = null;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      if (stateRef.current === "playing") {
        // ---- Smooth tilt (low-pass filter)
        const raw = rawTiltRef.current;
        const cal = calibRef.current;
        const targetRoll = Math.max(-1, Math.min(1, raw.roll - cal.roll));
        const targetPitch = Math.max(-1, Math.min(1, raw.pitch - cal.pitch));
        const smoothing = 0.18;
        smoothTiltRef.current.roll +=
          (targetRoll - smoothTiltRef.current.roll) * smoothing;
        smoothTiltRef.current.pitch +=
          (targetPitch - smoothTiltRef.current.pitch) * smoothing;

        // ---- Speed (boost/brake)
        const target = boostRef.current
          ? BOOST_SPEED
          : brakeRef.current
          ? BRAKE_SPEED
          : BASE_SPEED;
        speedRef.current += (target - speedRef.current) * 0.08;

        // ---- Score (survival)
        scoreRef.current += dt * (speedRef.current / BASE_SPEED) * 10;

        // ---- Background motion
        cloudOffsetRef.current =
          (cloudOffsetRef.current + speedRef.current * dt * 0.4) % SW;
        horizonOffsetRef.current =
          (horizonOffsetRef.current +
            smoothTiltRef.current.roll * sensRef.current * 80 * dt) %
          SW;

        // ---- Spawn objects
        lastSpawnRef.current += dt;
        const spawnInterval = 0.55;
        if (lastSpawnRef.current >= spawnInterval) {
          lastSpawnRef.current = 0;
          // 60% ring, 40% obstacle
          const isRing = Math.random() < 0.6;
          objectsRef.current.push({
            id: nextId++,
            type: isRing ? "ring" : "obstacle",
            x: (Math.random() - 0.5) * PLANE_X_RANGE * 2.4,
            y: (Math.random() - 0.5) * PLANE_Y_RANGE * 2.0,
            z: SPAWN_Z + Math.random() * 100,
            baseSize: isRing ? 55 : 70 + Math.random() * 30,
            hue: isRing ? "#FDE047" : Math.random() < 0.5 ? "#FCA5A5" : "#FBA5C5",
          });
        }

        // ---- Update objects (z decrease)
        const planeWorldX =
          smoothTiltRef.current.roll * sensRef.current * PLANE_X_RANGE;
        const planeWorldY =
          -smoothTiltRef.current.pitch * sensRef.current * PLANE_Y_RANGE;

        const objs = objectsRef.current;
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i];
          o.z -= speedRef.current * dt;
          if (o.z <= 5) {
            // missed -> remove
            objs.splice(i, 1);
            continue;
          }
          // Collision check window
          if (!o.collected && o.z < 60) {
            const dx = o.x - planeWorldX;
            const dy = o.y - planeWorldY;
            const distSq = dx * dx + dy * dy;
            const hitR = o.baseSize * 0.7 + PLANE_SIZE * 0.35;
            if (distSq < hitR * hitR) {
              if (o.type === "ring") {
                o.collected = true;
                collectedRingsRef.current += 1;
                scoreRef.current += 50;
                ringScoreFlashRef.current = {
                  x: SW / 2,
                  y: SH / 2 - 40,
                  t: now,
                };
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              } else {
                // crash
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
  }, []); // run once

  // Touch handlers (boost on hold, swipe down to brake)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (stateRef.current === "playing") {
          boostRef.current = true;
          setBoostActive(true);
        }
      },
      onPanResponderMove: (_, g) => {
        if (stateRef.current === "playing" && g.dy > 60 && g.vy > 0.5) {
          // swipe down -> brake
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

  // ---- Render world objects
  const cx = SW / 2;
  const cy = SH / 2;
  const planeWorldX =
    smoothTiltRef.current.roll * sensRef.current * PLANE_X_RANGE;
  const planeWorldY =
    -smoothTiltRef.current.pitch * sensRef.current * PLANE_Y_RANGE;
  const planeScreenX = cx + smoothTiltRef.current.roll * sensRef.current * 90;
  const planeScreenY =
    cy + smoothTiltRef.current.pitch * sensRef.current * 60 + 40;

  const renderedObjects = objectsRef.current
    .filter((o) => !o.collected && o.z > 5 && o.z < FAR_Z)
    .map((o) => {
      const scale = FOCAL / o.z;
      const sx = cx + (o.x - planeWorldX * 0.4) * scale;
      const sy = cy + (o.y - planeWorldY * 0.4) * scale + 40 * (1 - scale);
      const size = o.baseSize * scale;
      const opacity = Math.min(1, (FAR_Z - o.z) / 600);
      if (o.type === "ring") {
        return (
          <View
            key={o.id}
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: sx - size / 2,
                top: sy - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: Math.max(3, size * 0.18),
                borderColor: o.hue,
                opacity: 0.55 + 0.45 * opacity,
                shadowColor: o.hue,
                shadowOpacity: 0.9,
                shadowRadius: size * 0.25,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />
        );
      }
      return (
        <View
          key={o.id}
          pointerEvents="none"
          style={[
            styles.obstacle,
            {
              left: sx - size / 2,
              top: sy - size / 2,
              width: size,
              height: size * 0.85,
              borderRadius: size * 0.18,
              backgroundColor: o.hue,
              opacity: 0.5 + 0.5 * opacity,
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
      {/* Sky background */}
      <LinearGradient
        colors={["#FFDEE9", "#FFE3B5", "#B5FFFC"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Distant horizon strip */}
      <View
        style={[
          styles.horizon,
          {
            top: cy - 20 + tiltY * 30,
            transform: [{ rotate: `${-tiltX * 6}deg` }],
          },
        ]}
      />

      {/* Parallax clouds */}
      <ParallaxClouds
        offset={cloudOffsetRef.current}
        tiltX={tiltX}
        tiltY={tiltY}
      />

      {/* World objects */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {renderedObjects}
      </View>

      {/* Boost speed lines */}
      {boostActive && <BoostLines />}

      {/* Plane */}
      <View
        style={[
          styles.planeWrap,
          {
            left: planeScreenX - PLANE_SIZE / 2,
            top: planeScreenY - PLANE_SIZE / 2,
          },
        ]}
        pointerEvents="none"
      >
        <PaperPlane size={PLANE_SIZE} tilt={tiltX} pitch={-tiltY} />
      </View>

      {/* Touch capture layer (only during play) */}
      {state === "playing" && (
        <View
          style={StyleSheet.absoluteFill}
          {...panResponder.panHandlers}
          testID="touch-capture"
        />
      )}

      {/* HUD */}
      <SafeAreaView style={styles.hudSafe} pointerEvents="box-none">
        <View style={styles.hudTop} pointerEvents="box-none">
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

        {/* Pause + close */}
        {state === "playing" && (
          <View style={styles.cornerBtns} pointerEvents="box-none">
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

      {/* Boost indicator */}
      {boostActive && (
        <View style={styles.boostBadge} testID="boost-active">
          <Ionicons name="flash" size={14} color="#0F172A" />
          <Text style={styles.boostText}>BOOST</Text>
        </View>
      )}

      {/* Ready overlay */}
      {state === "ready" && (
        <Overlay>
          <Text style={styles.overlayTitle}>Ready?</Text>
          <Text style={styles.overlaySub}>
            Hold the screen to boost. Tilt to steer.
          </Text>
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

      {/* Calibration countdown */}
      {calibrating && (
        <View style={styles.calibrationOverlay} pointerEvents="none">
          <Text style={styles.calibrationText}>HOLD STEADY</Text>
          <Text style={styles.calibrationCount}>{calibCountdown}</Text>
        </View>
      )}

      {/* Pause overlay */}
      {state === "paused" && (
        <Overlay>
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

      {/* Game over overlay */}
      {state === "gameover" && (
        <Overlay>
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
              <Text style={styles.statValue}>{highScore}</Text>
            </View>
          </View>
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

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.overlayWrap} pointerEvents="box-none">
      <View style={styles.overlayPanel}>{children}</View>
    </View>
  );
}

function TiltIndicator({ tiltX, tiltY }: { tiltX: number; tiltY: number }) {
  const dotX = 22 + tiltX * 20;
  const dotY = 22 + tiltY * 20;
  return (
    <View style={styles.tiltIndicator} testID="tilt-indicator">
      <View style={styles.tiltCross} />
      <View style={styles.tiltCrossV} />
      <View
        style={[
          styles.tiltDot,
          { left: dotX - 6, top: dotY - 6 },
        ]}
      />
    </View>
  );
}

function BoostLines() {
  const lines = Array.from({ length: 10 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
}: {
  offset: number;
  tiltX: number;
  tiltY: number;
}) {
  const layers = [
    { speed: 0.4, y: 90, size: 110, count: 4, opacity: 0.55 },
    { speed: 0.7, y: 220, size: 80, count: 5, opacity: 0.7 },
    { speed: 1.0, y: SH - 260, size: 130, count: 3, opacity: 0.8 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.map((layer, li) =>
        Array.from({ length: layer.count }).map((_, i) => {
          const spacing = SW / layer.count + 80;
          const baseX =
            (i * spacing - (offset * layer.speed) % (SW + 200)) - 100;
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
                  left: ((x % (SW + 200)) + (SW + 200)) % (SW + 200) - 100,
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
  cloud: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },
  planeWrap: {
    position: "absolute",
    width: PLANE_SIZE,
    height: PLANE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  obstacle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  hudSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
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
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
  },
  hudPillCol: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.55)",
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
    backgroundColor: "rgba(255,255,255,0.55)",
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
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  boostBadge: {
    position: "absolute",
    bottom: 36,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    left: SW / 2 - 60,
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
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    width: SW - 60,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
  linkText: { color: "#0F172A", fontWeight: "700", textDecorationLine: "underline" },
  calibrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
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
});
