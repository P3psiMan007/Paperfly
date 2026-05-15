import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Share,
} from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  loadSensitivity,
  saveSensitivity,
  loadCalibration,
} from "../src/storage";
import {
  loadProgress,
  saveProgress,
  mergeProgress,
  Progress,
  DEFAULT_PROGRESS,
} from "../src/progression";
import { createSaveCode, fetchSaveByCode } from "../src/api";
import { isSfxEnabled, loadSfxEnabled, setSfxEnabled } from "../src/audio";

export default function Settings() {
  const router = useRouter();
  const [sensitivity, setSensitivity] = useState(1.0);
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [calibration, setCalibration] = useState({ pitch: 0, roll: 0 });
  const [savingCloud, setSavingCloud] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [restoreCode, setRestoreCode] = useState("");
  const [soundOn, setSoundOn] = useState(isSfxEnabled());

  useEffect(() => {
    loadSensitivity().then(setSensitivity);
    loadCalibration().then(setCalibration);
    loadProgress().then(setProgress);
    loadSfxEnabled().then(setSoundOn);
  }, []);

  const onSensitivityChange = (v: number) => {
    setSensitivity(v);
    saveSensitivity(v);
  };

  const resetHighScore = async () => {
    const next = { ...progress, bestScore: 0 };
    await saveProgress(next);
    setProgress(next);
  };

  const toggleSound = async (v: boolean) => {
    setSoundOn(v);
    await setSfxEnabled(v);
  };

  const handleBackup = async () => {
    setSavingCloud(true);
    try {
      const cur = await loadProgress();
      const code = await createSaveCode(cur);
      setSavedCode(code);
    } catch (e: any) {
      Alert.alert("Backup failed", e?.message || "Unknown error");
    } finally {
      setSavingCloud(false);
    }
  };

  const shareCode = async () => {
    if (!savedCode) return;
    try {
      await Share.share({
        message: `My Mr. Maybe Flight save code: ${savedCode}`,
      });
    } catch {}
  };

  const handleRestore = async () => {
    const cleaned = restoreCode.toUpperCase().trim();
    if (!cleaned) return;
    setRestoring(true);
    try {
      const restored = await fetchSaveByCode(cleaned);
      const localNow = await loadProgress();
      const merged = mergeProgress(localNow, restored as Partial<Progress>);
      await saveProgress(merged);
      setProgress(merged);
      Alert.alert(
        "Restored",
        "Save code applied. Your local high scores and unlocks were kept."
      );
      setRestoreCode("");
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message || "Save code not found");
    } finally {
      setRestoring(false);
    }
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
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>SOUND EFFECTS</Text>
                <Text style={styles.cardSub}>
                  Boost whoosh · ring chime · crash thud
                </Text>
              </View>
              <Switch
                testID="sound-toggle"
                value={soundOn}
                onValueChange={toggleSound}
                trackColor={{ false: "rgba(15,23,42,0.2)", true: "#0F172A" }}
                thumbColor="#FFFFFF"
              />
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
                hold the phone the way you'll play.
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
                finishes, tilt left/right to steer, forward/back to climb /
                descend.
              </Text>
              <Text style={styles.calibTip}>
                Tip: Recalibrate any time the plane drifts on its own.
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
            <Text style={styles.cardLabel}>SAVE PROGRESS · CLOUD</Text>
            <Text style={styles.cardSub}>
              Generate a code to back up your XP, skins and high scores. Use it
              on any device to restore.
            </Text>
            {savedCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeText} testID="save-code">
                  {savedCode}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={styles.actionBtnSmall}
                    onPress={shareCode}
                    testID="share-code"
                  >
                    <Ionicons
                      name="share-outline"
                      size={16}
                      color="#0F172A"
                    />
                    <Text style={styles.actionBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnSmall}
                    onPress={() => setSavedCode(null)}
                  >
                    <Ionicons name="close" size={16} color="#0F172A" />
                    <Text style={styles.actionBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleBackup}
                disabled={savingCloud}
                testID="backup-button"
              >
                <Ionicons name="cloud-upload-outline" size={18} color="#0F172A" />
                <Text style={styles.actionBtnText}>
                  {savingCloud ? "Backing up…" : "Generate Save Code"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.cardSub, { marginTop: 12 }]}>
              Have a save code? Restore it here.
            </Text>
            <TextInput
              testID="restore-code-input"
              style={styles.input}
              placeholder="ABCD-1234"
              placeholderTextColor="rgba(15,23,42,0.45)"
              value={restoreCode}
              onChangeText={setRestoreCode}
              autoCapitalize="characters"
              maxLength={9}
            />
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRestore}
              disabled={restoring || !restoreCode.trim()}
              testID="restore-button"
            >
              <Ionicons name="cloud-download-outline" size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>
                {restoring ? "Restoring…" : "Restore Progress"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>HIGH SCORE</Text>
            <Text style={styles.cardValue}>{progress.bestScore}</Text>
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
            <Text style={styles.tip}>• Tilt left/right to steer.</Text>
            <Text style={styles.tip}>• Tilt forward/back to climb/descend.</Text>
            <Text style={styles.tip}>• Tap & hold the screen for boost.</Text>
            <Text style={styles.tip}>• Swipe down on screen to brake.</Text>
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
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.7,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
  },
  cardSub: {
    fontSize: 13,
    color: "#0F172A",
    opacity: 0.7,
    fontWeight: "600",
    lineHeight: 19,
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
  actionBtnSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    marginTop: 6,
  },
  codeBox: {
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  codeText: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#0F172A",
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
  calibStepNum: { fontWeight: "900", color: "#0F172A" },
  calibStrong: { fontWeight: "900", color: "#0F172A" },
  calibTip: {
    color: "#0F172A",
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "600",
    opacity: 0.75,
    marginTop: 4,
  },
});
