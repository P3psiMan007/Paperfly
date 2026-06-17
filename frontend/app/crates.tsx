import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import PaperPlane from "../src/PaperPlane";
import {
  loadProgress,
  saveProgress,
  Progress,
  DEFAULT_PROGRESS,
} from "../src/progression";
import {
  rollCrate,
  KEY_PACKS,
  KeyPack,
  CrateRollResult,
} from "../src/crates";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  SkinRarity,
} from "../src/skins";
import {
  initPurchases,
  endPurchases,
  purchaseKeys,
  isNativePurchaseAvailable,
} from "../src/iap";

export default function Crates() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<CrateRollResult | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const reveal = useMemo(() => new Animated.Value(0), []);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const [shimmerVal, setShimmerVal] = useState(0);
  const nativeAvailable = useRef(isNativePurchaseAvailable());

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
    initPurchases({
      onSkinUnlock: async () => refresh(),
      onKeysGranted: async (count) => {
        const cur = await loadProgress();
        const next = { ...cur, keys: (cur.keys || 0) + count };
        await saveProgress(next);
        setProgress(next);
        Alert.alert("Keys added", `You received ${count} key${count > 1 ? "s" : ""}.`);
      },
    });
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
      endPurchases();
    };
  }, [refresh, shimmer]);

  const playRevealAnimation = useCallback(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal]);

  const openCrate = async () => {
    if (opening) return;
    const cur = await loadProgress();
    if ((cur.crates || 0) <= 0) {
      Alert.alert("No crates", "Earn crates by playing the game!");
      return;
    }
    if ((cur.keys || 0) <= 0) {
      Alert.alert(
        "No keys",
        "You need a key to open a crate. Buy a key pack below."
      );
      return;
    }
    setOpening(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    // Consume key + crate, roll outcome, apply.
    const roll = rollCrate(cur.ownedSkins);
    const next: Progress = {
      ...cur,
      keys: cur.keys - 1,
      crates: cur.crates - 1,
      cratesOpened: (cur.cratesOpened || 0) + 1,
    };
    if (roll.kind === "new_skin") {
      next.ownedSkins = [...next.ownedSkins, roll.skin.id];
    } else {
      next.xp = next.xp + roll.dustXp;
      next.duplicateDustXp = (next.duplicateDustXp || 0) + roll.dustXp;
    }
    await saveProgress(next);
    setProgress(next);
    setResult(roll);
    playRevealAnimation();
    if (Platform.OS !== "web") {
      const isRare =
        roll.kind === "new_skin" &&
        (roll.skin.rarity === "legendary" || roll.skin.rarity === "mythic");
      if (isRare) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
    }
    setTimeout(() => setOpening(false), 1200);
  };

  const buyKeys = async (pack: KeyPack) => {
    setPurchasing(pack.id);
    try {
      const outcome = await purchaseKeys(pack.productId);
      if (outcome.kind === "iap_pending") {
        // listener will update keys count
      } else if (outcome.kind === "unsupported") {
        Alert.alert(
          "Native build required",
          outcome.message +
            "\n\nFor now we'll grant the keys locally so you can try the system. (Real builds will go through the App Store.)"
        );
        // Dev convenience: locally grant the keys in Expo Go / web preview.
        const cur = await loadProgress();
        const next = { ...cur, keys: (cur.keys || 0) + pack.keys };
        await saveProgress(next);
        setProgress(next);
      } else if (outcome.kind === "error") {
        Alert.alert("Purchase failed", outcome.message);
      }
    } finally {
      setPurchasing(null);
    }
  };

  const closeReveal = () => setResult(null);

  const revealScale = reveal.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.3, 1.1, 1],
  });
  const revealOpacity = reveal.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <LinearGradient
      colors={["#0F172A", "#312E81", "#581C87"]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="crates-back"
          >
            <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crates</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.stats}>
            <View style={styles.statBox}>
              <Ionicons name="cube" size={22} color="#FDE047" />
              <Text style={styles.statValue} testID="crate-count">
                {progress.crates}
              </Text>
              <Text style={styles.statLabel}>CRATES</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="key" size={22} color="#FDE047" />
              <Text style={styles.statValue} testID="key-count">
                {progress.keys}
              </Text>
              <Text style={styles.statLabel}>KEYS</Text>
            </View>
          </View>

          <View style={styles.crateCard}>
            <Animated.View
              style={{
                transform: [
                  {
                    translateY: shimmer.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -8, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.crateGlow} />
              <View style={styles.crateBody}>
                <Ionicons name="cube" size={88} color="#FDE047" />
              </View>
            </Animated.View>
            <Text style={styles.crateTitle}>Standard Crate</Text>
            <Text style={styles.crateSub}>
              Contains 1 random skin — anything from Common to Mythic.
            </Text>

            <View style={styles.oddsBox}>
              {(
                ["common", "rare", "epic", "legendary", "mythic"] as SkinRarity[]
              ).map((r) => (
                <View key={r} style={styles.oddsRow}>
                  <View
                    style={[styles.oddsDot, { backgroundColor: RARITY_COLOR[r] }]}
                  />
                  <Text style={styles.oddsLabel}>{RARITY_LABEL[r]}</Text>
                  <Text style={styles.oddsPct}>{ODDS_LABEL[r]}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.openBtn,
                (progress.crates <= 0 || progress.keys <= 0 || opening) &&
                  styles.openBtnDisabled,
              ]}
              onPress={openCrate}
              disabled={progress.crates <= 0 || progress.keys <= 0 || opening}
              testID="open-crate-button"
            >
              {opening ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <>
                  <Ionicons name="key" size={20} color="#0F172A" />
                  <Text style={styles.openBtnText}>USE 1 KEY · OPEN CRATE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>BUY KEYS</Text>
          <View style={styles.packGrid}>
            {KEY_PACKS.map((pack) => (
              <TouchableOpacity
                key={pack.id}
                style={styles.packCard}
                onPress={() => buyKeys(pack)}
                disabled={purchasing === pack.id}
                testID={`buy-${pack.id}`}
              >
                {pack.badge && (
                  <View style={styles.packBadge}>
                    <Text style={styles.packBadgeText}>{pack.badge}</Text>
                  </View>
                )}
                <Ionicons name="key" size={32} color="#FDE047" />
                <Text style={styles.packCount}>{pack.keys}</Text>
                <Text style={styles.packLabel}>KEYS</Text>
                {purchasing === pack.id ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <View style={styles.packPrice}>
                    <Text style={styles.packPriceText}>{pack.priceLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.footnote}>
            Crates drop randomly while you play. Buy keys to open them.
          </Text>
          {!nativeAvailable.current && (
            <Text style={[styles.footnote, { opacity: 0.55 }]}>
              Note: native in-app purchases need a real iOS/Android build.
              In preview, keys are granted locally so you can try the system.
            </Text>
          )}
        </ScrollView>

        {result && (
          <View style={styles.revealOverlay} testID="reveal-overlay">
            <View style={styles.revealBackdrop} />
            <Animated.View
              style={[
                styles.revealCard,
                {
                  transform: [{ scale: revealScale }],
                  opacity: revealOpacity,
                  borderColor: RARITY_COLOR[result.skin.rarity],
                  shadowColor: RARITY_COLOR[result.skin.rarity],
                },
              ]}
            >
              <View
                style={[
                  styles.revealRarityPill,
                  { backgroundColor: RARITY_COLOR[result.skin.rarity] },
                ]}
              >
                <Text style={styles.revealRarityText}>
                  {RARITY_LABEL[result.skin.rarity].toUpperCase()}
                </Text>
              </View>
              <PaperPlane
                size={140}
                skinId={result.skin.id}
                shimmerPhase={shimmerVal}
                flameTick={(shimmerVal * 5) % 1}
              />
              <Text style={styles.revealName}>{result.skin.name}</Text>
              <Text style={styles.revealTagline}>{result.skin.tagline}</Text>
              {result.kind === "duplicate" && (
                <View style={styles.dupChip}>
                  <Ionicons name="refresh" size={14} color="#0F172A" />
                  <Text style={styles.dupChipText}>
                    DUPLICATE · +{result.dustXp} XP DUST
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.revealBtn} onPress={closeReveal}>
                <Text style={styles.revealBtnText}>CONTINUE</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const ODDS_LABEL: Record<SkinRarity, string> = {
  common: "55%",
  rare: "25%",
  epic: "12%",
  legendary: "6%",
  mythic: "2%",
};

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
    borderColor: "#F8FAFC",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  content: { padding: 18, paddingBottom: 40, gap: 18 },
  stats: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "#FDE047",
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 30, fontWeight: "900", color: "#F8FAFC" },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
    color: "#CBD5E1",
  },
  crateCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "#FDE047",
    borderWidth: 2,
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    gap: 12,
  },
  crateGlow: {
    position: "absolute",
    top: 20,
    left: -10,
    right: -10,
    bottom: 0,
    backgroundColor: "#FDE047",
    opacity: 0.15,
    borderRadius: 60,
  },
  crateBody: {
    width: 140,
    height: 140,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#FDE047",
    backgroundColor: "rgba(253,224,71,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  crateTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F8FAFC",
    marginTop: 6,
  },
  crateSub: {
    fontSize: 13,
    color: "#CBD5E1",
    textAlign: "center",
    fontWeight: "600",
  },
  oddsBox: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  oddsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  oddsDot: { width: 10, height: 10, borderRadius: 5 },
  oddsLabel: { flex: 1, color: "#F8FAFC", fontWeight: "700", fontSize: 12 },
  oddsPct: {
    color: "#FDE047",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 4,
    width: "100%",
  },
  openBtnDisabled: { opacity: 0.45 },
  openBtnText: {
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1.2,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#CBD5E1",
  },
  packGrid: {
    flexDirection: "row",
    gap: 10,
  },
  packCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderColor: "#FDE047",
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  packBadge: {
    position: "absolute",
    top: -8,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  packBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  packCount: { fontSize: 28, fontWeight: "900", color: "#0F172A" },
  packLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#0F172A",
  },
  packPrice: {
    marginTop: 4,
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  packPriceText: { color: "#FDE047", fontWeight: "900", fontSize: 13 },
  footnote: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.85,
  },
  // reveal overlay
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  revealBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.85)",
  },
  revealCard: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    borderWidth: 3,
    padding: 24,
    alignItems: "center",
    width: "82%",
    gap: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30,
    shadowOpacity: 0.7,
    elevation: 16,
  },
  revealRarityPill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
  },
  revealRarityText: {
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 2,
    fontSize: 11,
  },
  revealName: { color: "#F8FAFC", fontSize: 24, fontWeight: "900" },
  revealTagline: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  dupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDE047",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dupChipText: { color: "#0F172A", fontWeight: "900", fontSize: 11 },
  revealBtn: {
    backgroundColor: "#FDE047",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 10,
  },
  revealBtnText: { color: "#0F172A", fontWeight: "900", letterSpacing: 1.5 },
});
