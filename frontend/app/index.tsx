import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PaperPlane from "../src/PaperPlane";
import { loadHighScore } from "../src/storage";

export default function Index() {
  const router = useRouter();
  const [highScore, setHighScore] = useState(0);

  const refresh = useCallback(() => {
    loadHighScore().then(setHighScore);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <LinearGradient
      colors={["#FFDEE9", "#B5FFFC"]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        {/* Floating clouds decoration */}
        <View style={[styles.cloud, { top: 240, left: 30, opacity: 0.85 }]} />
        <View
          style={[
            styles.cloud,
            { top: 320, right: 20, opacity: 0.7, transform: [{ scale: 0.7 }] },
          ]}
        />
        <View
          style={[
            styles.cloud,
            { bottom: 200, left: 50, opacity: 0.6, transform: [{ scale: 0.5 }] },
          ]}
        />

        <View style={styles.content}>
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow} testID="title-eyebrow">
              TILT TO FLY
            </Text>
            <Text style={styles.title}>Mr. Maybe</Text>
            <Text style={styles.titleAccent}>Flight</Text>
          </View>

          <View style={styles.planeBox}>
            <PaperPlane size={160} tilt={-0.15} pitch={0.05} />
          </View>

          <View style={styles.scoreCard} testID="high-score-card">
            <Text style={styles.scoreLabel}>BEST SCORE</Text>
            <Text style={styles.scoreValue}>{highScore}</Text>
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

            <View style={styles.row}>
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
                <Text style={styles.secondaryBtnText}>Calibrate</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footnote}>
            Hold screen to boost · Swipe down to brake
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  cloud: {
    position: "absolute",
    width: 120,
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  headerBlock: { alignItems: "flex-start" },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#0F172A",
    opacity: 0.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 56,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -2,
    lineHeight: 58,
  },
  titleAccent: {
    fontSize: 56,
    fontWeight: "900",
    color: "#FDE047",
    letterSpacing: -2,
    lineHeight: 58,
  },
  planeBox: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  scoreCard: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#0F172A",
    opacity: 0.7,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  buttons: { gap: 14 },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", gap: 12 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
  },
  footnote: {
    textAlign: "center",
    color: "#0F172A",
    opacity: 0.55,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
});
