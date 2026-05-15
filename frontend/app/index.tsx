import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PaperPlane from "../src/PaperPlane";
import Cloud from "../src/Cloud";
import TutorialOverlay from "../src/Tutorial";
import {
  loadProgress,
  Progress,
  nextLevelInfo,
  DEFAULT_PROGRESS,
} from "../src/progression";
import { todaySeedString } from "../src/daily";

const TUTORIAL_KEY = "@mmf_tutorial_seen";

export default function Index() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [showTutorial, setShowTutorial] = useState(false);
  const bobAnim = useMemo(() => new Animated.Value(0), []);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const [shimmerVal, setShimmerVal] = useState(0);

  const refresh = useCallback(async () => {
    const p = await loadProgress();
    setProgress(p);
  }, []);

  useEffect(() => {
    refresh();
    AsyncStorage.getItem(TUTORIAL_KEY).then((v) => {
      if (v !== "1") setShowTutorial(true);
    });
    const useNative = Platform.OS !== "web";
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );
    bobLoop.start();
    const id = shimmer.addListener(({ value }) => setShimmerVal(value));
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    shimmerLoop.start();
    return () => {
      bobLoop.stop();
      shimmerLoop.stop();
      shimmer.removeListener(id);
    };
  }, [refresh, bobAnim, shimmer]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const dismissTutorial = async () => {
    setShowTutorial(false);
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, "1");
    } catch {}
  };

  const planeTranslateY = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });
  const planeRotate = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "3deg"],
  });

  const lvl = nextLevelInfo(progress.xp);
  const dailyTodayBest =
    progress.lastDailySeed === todaySeedString()
      ? progress.lastDailyScore || 0
      : 0;

  return (
    <LinearGradient
      colors={["#FFDEE9", "#FFE3B5", "#B5FFFC"]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={[styles.cloudPos, { top: 220, left: 20 }]}>
          <Cloud width={140} height={56} opacity={0.85} />
        </View>
        <View style={[styles.cloudPos, { top: 320, right: 10 }]}>
          <Cloud width={100} height={42} opacity={0.7} />
        </View>
        <View style={[styles.cloudPos, { bottom: 260, left: 40 }]}>
          <Cloud width={120} height={50} opacity={0.6} />
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerBlock}>
              <Text style={styles.eyebrow} testID="title-eyebrow">
                TILT TO FLY
              </Text>
              <Text style={styles.title}>Mr. Maybe</Text>
              <Text style={styles.titleAccent}>Flight</Text>
            </View>
            <View style={styles.levelBadge} testID="level-badge">
              <Ionicons name="star" size={12} color="#0F172A" />
              <Text style={styles.levelBadgeText}>LVL {lvl.level}</Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.planeBox,
              {
                transform: [
                  { translateY: planeTranslateY },
                  { rotate: planeRotate },
                ],
              },
            ]}
          >
            <PaperPlane
              size={150}
              tilt={-0.1}
              pitch={0.05}
              skinId={progress.equippedSkin}
              shimmerPhase={shimmerVal}
              flameTick={(shimmerVal * 5) % 1}
            />
          </Animated.View>

          <View style={styles.xpCard} testID="xp-card">
            <View style={styles.xpRowTop}>
              <Text style={styles.xpLabel}>
                {lvl.isMax
                  ? "MAX LEVEL"
                  : `${lvl.xpInto} / ${lvl.xpNeeded} XP`}
              </Text>
              <Text style={styles.xpBest}>BEST {progress.bestScore}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View
                style={[
                  styles.xpFill,
                  { width: `${Math.round(lvl.progress * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/game")}
              testID="start-game-button"
            >
              <Ionicons name="play" size={22} color="#0F172A" />
              <Text style={styles.primaryBtnText}>START GAME</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dailyBtn}
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: "/game", params: { daily: "1" } })
              }
              testID="daily-button"
            >
              <Ionicons name="calendar" size={18} color="#0F172A" />
              <Text style={styles.dailyBtnText}>DAILY CHALLENGE</Text>
              {dailyTodayBest > 0 && (
                <View style={styles.dailyChip}>
                  <Text style={styles.dailyChipText}>{dailyTodayBest}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.row}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => router.push("/skins")}
                testID="skins-button"
              >
                <Ionicons name="shirt-outline" size={18} color="#0F172A" />
                <Text style={styles.secondaryBtnText}>Skins</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => router.push("/settings")}
                testID="settings-button"
              >
                <Ionicons name="settings-outline" size={18} color="#0F172A" />
                <Text style={styles.secondaryBtnText}>Settings</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() =>
                  router.push({ pathname: "/game", params: { calibrate: "1" } })
                }
                testID="calibrate-shortcut"
              >
                <Ionicons name="compass-outline" size={18} color="#0F172A" />
                <Text style={styles.secondaryBtnText}>Calib.</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footnote}>
            Hold screen to boost · Swipe down to brake
          </Text>
        </View>

        {showTutorial && <TutorialOverlay onDone={dismissTutorial} />}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  cloudPos: { position: "absolute" },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerBlock: { alignItems: "flex-start", flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#0F172A",
    opacity: 0.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 46,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -2,
    lineHeight: 48,
  },
  titleAccent: {
    fontSize: 46,
    fontWeight: "900",
    color: "#FDE047",
    letterSpacing: -2,
    lineHeight: 48,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    marginTop: 8,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1.5,
  },
  planeBox: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  xpCard: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  xpRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0F172A",
  },
  xpBest: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0F172A",
    opacity: 0.6,
  },
  xpTrack: {
    height: 10,
    backgroundColor: "rgba(15,23,42,0.12)",
    borderRadius: 6,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: "#0F172A",
  },
  buttons: { gap: 10 },
  primaryBtn: {
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 1,
  },
  dailyBtn: {
    backgroundColor: "#A5F3FC",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dailyBtnText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.2,
  },
  dailyChip: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dailyChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  row: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryBtnText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  footnote: {
    textAlign: "center",
    color: "#0F172A",
    opacity: 0.55,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
});
