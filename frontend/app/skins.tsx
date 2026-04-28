import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PaperPlane from "../src/PaperPlane";
import {
  loadProgress,
  saveProgress,
  Progress,
  levelFromXp,
} from "../src/progression";
import {
  SKIN_LIST,
  Skin,
  unlockSummary,
  ACHIEVEMENTS,
} from "../src/skins";

export default function Skins() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const [shimmerVal, setShimmerVal] = useState(0);

  const refresh = useCallback(() => {
    loadProgress().then(setProgress);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    refresh();
    const id = shimmer.addListener(({ value }) => setShimmerVal(value));
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      shimmer.removeListener(id);
    };
  }, [refresh, shimmer]);

  const equip = async (id: Skin["id"]) => {
    if (!progress) return;
    if (!progress.ownedSkins.includes(id)) return;
    const next = { ...progress, equippedSkin: id };
    setProgress(next);
    await saveProgress(next);
  };

  if (!progress) {
    return (
      <LinearGradient colors={["#FFDEE9", "#B5FFFC"]} style={styles.gradient}>
        <SafeAreaView style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const level = levelFromXp(progress.xp);

  return (
    <LinearGradient
      colors={["#FFDEE9", "#FFE3B5", "#B5FFFC"]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="skins-back"
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Skins</Text>
          <View style={styles.levelChip}>
            <Ionicons name="star" size={12} color="#0F172A" />
            <Text style={styles.levelChipText}>LVL {level}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>FREE · EARN BY PLAYING</Text>
          <View style={styles.grid}>
            {SKIN_LIST.filter((s) => s.type === "free").map((s) => (
              <SkinCard
                key={s.id}
                skin={s}
                owned={progress.ownedSkins.includes(s.id)}
                equipped={progress.equippedSkin === s.id}
                onEquip={equip}
                shimmerVal={shimmerVal}
              />
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
            PREMIUM · COMING SOON
          </Text>
          <View style={styles.grid}>
            {SKIN_LIST.filter((s) => s.type === "premium").map((s) => (
              <SkinCard
                key={s.id}
                skin={s}
                owned={progress.ownedSkins.includes(s.id)}
                equipped={progress.equippedSkin === s.id}
                onEquip={equip}
                shimmerVal={shimmerVal}
              />
            ))}
          </View>

          {progress.achievements.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
                YOUR ACHIEVEMENTS
              </Text>
              <View style={styles.achList}>
                {progress.achievements.map((a) => (
                  <View key={a} style={styles.achItem}>
                    <Ionicons name="trophy" size={16} color="#0F172A" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achName}>
                        {ACHIEVEMENTS[a].name}
                      </Text>
                      <Text style={styles.achDesc}>
                        {ACHIEVEMENTS[a].description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function SkinCard({
  skin,
  owned,
  equipped,
  onEquip,
  shimmerVal,
}: {
  skin: Skin;
  owned: boolean;
  equipped: boolean;
  onEquip: (id: Skin["id"]) => void;
  shimmerVal: number;
}) {
  const locked = !owned;
  const isPremium = skin.type === "premium";
  return (
    <TouchableOpacity
      activeOpacity={owned ? 0.85 : 1}
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        locked && styles.cardLocked,
      ]}
      onPress={() => owned && !equipped && onEquip(skin.id)}
      testID={`skin-card-${skin.id}`}
    >
      {isPremium && (
        <View style={styles.premiumBadge}>
          <Ionicons name="diamond" size={10} color="#0F172A" />
          <Text style={styles.premiumBadgeText}>PREMIUM</Text>
        </View>
      )}
      <View style={styles.preview}>
        <PaperPlane
          size={86}
          tilt={-0.1}
          pitch={0.05}
          skinId={skin.id}
          shimmerPhase={shimmerVal}
          flameTick={(shimmerVal * 5) % 1}
        />
      </View>
      <Text style={styles.skinName}>{skin.name}</Text>
      <Text style={styles.skinTagline} numberOfLines={2}>
        {skin.tagline}
      </Text>
      {locked ? (
        <View style={styles.lockChip}>
          <Ionicons name="lock-closed" size={11} color="#0F172A" />
          <Text style={styles.lockText} numberOfLines={1}>
            {unlockSummary(skin)}
          </Text>
        </View>
      ) : equipped ? (
        <View style={styles.equippedChip}>
          <Ionicons name="checkmark-circle" size={12} color="#0F172A" />
          <Text style={styles.equippedText}>EQUIPPED</Text>
        </View>
      ) : (
        <View style={styles.equipChip}>
          <Text style={styles.equipText}>TAP TO EQUIP</Text>
        </View>
      )}
    </TouchableOpacity>
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
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: "#0F172A",
    backgroundColor: "#FDE047",
    borderRadius: 999,
  },
  levelChipText: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "900",
    color: "#0F172A",
  },
  content: { padding: 18, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#0F172A",
    opacity: 0.7,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    minHeight: 200,
  },
  cardEquipped: {
    backgroundColor: "#FDE047",
  },
  cardLocked: {
    opacity: 0.78,
  },
  preview: {
    height: 100,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  skinName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  skinTagline: {
    fontSize: 11,
    color: "#0F172A",
    opacity: 0.65,
    textAlign: "center",
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 8,
    minHeight: 28,
  },
  lockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(15,23,42,0.08)",
    borderRadius: 999,
    maxWidth: "100%",
  },
  lockText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  equippedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#0F172A",
    borderRadius: 999,
  },
  equippedText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  equipChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 999,
  },
  equipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  premiumBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 1.5,
    borderRadius: 999,
    zIndex: 2,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1,
  },
  achList: { gap: 8, marginTop: 4 },
  achItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
  },
  achName: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  achDesc: {
    fontSize: 12,
    color: "#0F172A",
    opacity: 0.7,
    fontWeight: "600",
  },
});
