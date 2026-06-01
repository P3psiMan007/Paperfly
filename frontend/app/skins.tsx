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
import { hNotify, NotifyType } from "../src/haptics";
import PaperPlane from "../src/PaperPlane";
import {
  loadProgress,
  saveProgress,
  Progress,
  levelFromXp,
  xpForLevel,
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

  const refresh = useCallback(async () => {
    const p = await loadProgress();
    setProgress(p);
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
  const freeSkins = SKIN_LIST.filter((s) => s.tier === "free");
  const rareSkins = SKIN_LIST.filter((s) => s.tier === "rare");

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
            accessibilityRole="button"
            accessibilityLabel="Back"
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
          <Text style={styles.sectionLabel}>EARN BY PLAYING</Text>
          <View style={styles.grid}>
            {freeSkins.map((s) => (
              <SkinCard
                key={s.id}
                skin={s}
                owned={progress.ownedSkins.includes(s.id)}
                equipped={progress.equippedSkin === s.id}
                onEquip={equip}
                shimmerVal={shimmerVal}
                playerXp={progress.xp}
              />
            ))}
          </View>

          <View style={styles.rareHeader}>
            <Text style={[styles.sectionLabel, { marginTop: 0 }]}>
              RARE · CHALLENGE UNLOCKS
            </Text>
            <View style={styles.rareDot} />
          </View>
          <View style={styles.grid}>
            {rareSkins.map((s) => (
              <SkinCard
                key={s.id}
                skin={s}
                owned={progress.ownedSkins.includes(s.id)}
                equipped={progress.equippedSkin === s.id}
                onEquip={equip}
                shimmerVal={shimmerVal}
                playerXp={progress.xp}
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
  playerXp,
}: {
  skin: Skin;
  owned: boolean;
  equipped: boolean;
  onEquip: (id: Skin["id"]) => void;
  shimmerVal: number;
  playerXp: number;
}) {
  const locked = !owned;
  const isRare = skin.tier === "rare";

  // Equip pop: a quick scale 1 → 1.12 → 1 + success haptic so equipping feels
  // like a reward rather than a silent state flip (audit 2.6.2).
  const pop = React.useRef(new Animated.Value(0)).current;
  const handlePress = () => {
    if (owned && !equipped) {
      onEquip(skin.id);
      hNotify(NotifyType.Success);
      pop.setValue(0);
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 0,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };
  const popScale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  // For level-locked skins, show concrete XP progress toward the unlock
  // (audit 2.6.1) — visible progress motivates more than a closed lock.
  const levelLock = skin.unlock.kind === "level" ? skin.unlock.level : null;
  const levelTargetXp = levelLock !== null ? xpForLevel(levelLock) : 0;
  const levelFrac =
    levelLock !== null && levelTargetXp > 0
      ? Math.min(1, playerXp / levelTargetXp)
      : 0;

  return (
    <Animated.View
      style={[styles.cardWrap, { transform: [{ scale: popScale }] }]}
    >
    <TouchableOpacity
      activeOpacity={owned ? 0.85 : 1}
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        locked && styles.cardLocked,
      ]}
      onPress={handlePress}
      testID={`skin-card-${skin.id}`}
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${skin.name}, locked. ${unlockSummary(skin)}`
          : equipped
          ? `${skin.name}, equipped`
          : `${skin.name}, tap to equip`
      }
      accessibilityState={{ disabled: locked, selected: equipped }}
    >
      {isRare && (
        <View style={styles.rareBadge}>
          <Ionicons name="diamond" size={10} color="#0F172A" />
          <Text style={styles.rareBadgeText}>RARE</Text>
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
        levelLock !== null ? (
          <View style={styles.lockProgress}>
            <View style={styles.lockChip}>
              <Ionicons name="lock-closed" size={11} color="#0F172A" />
              <Text style={styles.lockText} numberOfLines={1}>
                LVL {levelLock}
              </Text>
            </View>
            <View style={styles.xpMiniTrack}>
              <View
                style={[
                  styles.xpMiniFill,
                  { width: `${Math.round(levelFrac * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.xpMiniText} numberOfLines={1}>
              {Math.min(playerXp, levelTargetXp)} / {levelTargetXp} XP
            </Text>
          </View>
        ) : (
          <View style={styles.lockChip}>
            <Ionicons name="lock-closed" size={11} color="#0F172A" />
            <Text style={styles.lockText} numberOfLines={1}>
              {unlockSummary(skin)}
            </Text>
          </View>
        )
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
    </Animated.View>
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
  rareHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 10,
  },
  rareDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A78BFA",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardWrap: { width: "48%" },
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    minHeight: 200,
  },
  cardEquipped: { backgroundColor: "#FDE047" },
  cardLocked: { opacity: 0.92 },
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
  lockProgress: {
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  xpMiniTrack: {
    height: 5,
    width: "85%",
    backgroundColor: "rgba(15,23,42,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  xpMiniFill: {
    height: "100%",
    backgroundColor: "#0F172A",
  },
  xpMiniText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.7,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 999,
  },
  equipText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  rareBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#A78BFA",
    borderColor: "#0F172A",
    borderWidth: 1.5,
    borderRadius: 999,
    zIndex: 2,
  },
  rareBadgeText: {
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
