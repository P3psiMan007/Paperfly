import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  loadSensitivity,
  saveSensitivity,
  loadHighScore,
  saveHighScore,
  loadCalibration,
} from "../src/storage";

export default function Settings() {
  const router = useRouter();
  const [sensitivity, setSensitivity] = useState(1.0);
  const [highScore, setHighScore] = useState(0);
  const [calibration, setCalibration] = useState({ pitch: 0, roll: 0 });

  useEffect(() => {
    loadSensitivity().then(setSensitivity);
    loadHighScore().then(setHighScore);
    loadCalibration().then(setCalibration);
  }, []);

  const onSensitivityChange = (v: number) => {
    setSensitivity(v);
    saveSensitivity(v);
  };

  const resetHighScore = async () => {
    await saveHighScore(0);
    setHighScore(0);
  };

  return (
    <LinearGradient colors={["#FFDEE9", "#B5FFFC"]} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="settings-back"
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TILT SENSITIVITY</Text>
            <Text style={styles.cardValue}>{sensitivity.toFixed(2)}x</Text>
            <Slider
              testID="sensitivity-slider"
              style={{ width: "100%", height: 40 }}
              minimumValue={0.3}
              maximumValue={2.5}
              step={0.05}
              value={sensitivity}
              onValueChange={onSensitivityChange}
              minimumTrackTintColor="#0F172A"
              maximumTrackTintColor="rgba(15,23,42,0.2)"
              thumbTintColor="#FFFFFF"
            />
            <View style={styles.scaleRow}>
              <Text style={styles.scaleText}>Gentle</Text>
              <Text style={styles.scaleText}>Sharp</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CALIBRATION</Text>
            <Text style={styles.cardSub}>
              Pitch: {calibration.pitch.toFixed(3)} · Roll:{" "}
              {calibration.roll.toFixed(3)}
            </Text>
            <View style={styles.calibSteps}>
              <Text style={styles.calibStep}>
                <Text style={styles.calibStepNum}>1.</Text>  Sit comfortably and
                hold the phone the way you'll play (usually tilted slightly
                toward you).
              </Text>
              <Text style={styles.calibStep}>
                <Text style={styles.calibStepNum}>2.</Text>  Tap{" "}
                <Text style={styles.calibStrong}>Recalibrate Now</Text>.
              </Text>
              <Text style={styles.calibStep}>
                <Text style={styles.calibStepNum}>3.</Text>  Hold absolutely
                still during the 3-2-1 countdown — that pose becomes your new
                neutral.
              </Text>
              <Text style={styles.calibStep}>
                <Text style={styles.calibStepNum}>4.</Text>  After the countdown
                finishes, the plane will fly straight when you hold that pose.
                Tilt left/right to steer, forward/back to climb/descend.
              </Text>
              <Text style={styles.calibTip}>
                Tip: Recalibrate any time the plane drifts on its own — usually
                means your "neutral" pose has shifted.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                router.push({ pathname: "/game", params: { calibrate: "1" } })
              }
              testID="recalibrate-button"
            >
              <Ionicons name="compass-outline" size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>Recalibrate Now</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>HIGH SCORE</Text>
            <Text style={styles.cardValue}>{highScore}</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={resetHighScore}
              testID="reset-highscore"
            >
              <Ionicons name="refresh" size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>Reset High Score</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>HOW TO PLAY</Text>
            <Text style={styles.tip}>• Tilt phone left/right to steer.</Text>
            <Text style={styles.tip}>• Tilt forward/back to climb/descend.</Text>
            <Text style={styles.tip}>• Tap & hold the screen for boost.</Text>
            <Text style={styles.tip}>
              • Swipe down on screen to brake briefly.
            </Text>
            <Text style={styles.tip}>• Fly through golden rings for points.</Text>
            <Text style={styles.tip}>• Avoid pink storm clouds!</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#0F172A",
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.7,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
  },
  cardSub: {
    fontSize: 13,
    color: "#0F172A",
    opacity: 0.7,
    fontWeight: "600",
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  scaleText: {
    fontSize: 11,
    color: "#0F172A",
    opacity: 0.55,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  actionBtnText: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  tip: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  calibSteps: {
    backgroundColor: "rgba(181,255,252,0.35)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    gap: 6,
  },
  calibStep: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  calibStepNum: {
    fontWeight: "900",
    color: "#0F172A",
  },
  calibStrong: {
    fontWeight: "900",
    color: "#0F172A",
  },
  calibTip: {
    color: "#0F172A",
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "600",
    opacity: 0.75,
    marginTop: 4,
  },
});
