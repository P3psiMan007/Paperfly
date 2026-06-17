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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
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
  RARITY_ORDER,
  RARITY_LABEL,
  RARITY_COLOR,
} from "../src/skins";
import { getCheckoutStatus, getOwnedSkins } from "../src/api";
import {
  initPurchases,
  endPurchases,
  purchaseSkin,
} from "../src/iap";

export default function Skins() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    session_id?: string;
    cancelled?: string;
  }>();
  const [progress, setProgress] = useState<Progress | null>(null);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const [shimmerVal, setShimmerVal] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollAttemptsRef = useRef(0);

  const refresh = useCallback(async () => {
    const p = await loadProgress();
    try {
      const owned = await getOwnedSkins();
      if (owned.length) {
        const merged = Array.from(new Set([...p.ownedSkins, ...(owned as any)]));
        if (merged.length !== p.ownedSkins.length) {
          const updated = { ...p, ownedSkins: merged as any };
          await saveProgress(updated);
          setProgress(updated);
          return;
        }
      }
    } catch {}
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
      onSkinUnlock: async (skinId) => {
        await refresh();
        Alert.alert("Purchase complete!", `Unlocked ${skinId} skin.`);
      },
      onKeysGranted: async () => {
        // ignored here; handled in crates screen
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

  useEffect(() => {
    if (params.session_id) {
      pollPaymentStatus(params.session_id as string);
    } else if (params.cancelled === "1") {
      Alert.alert("Payment cancelled");
      router.setParams({ cancelled: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.session_id, params.cancelled]);

  const pollPaymentStatus = async (sessionId: string) => {
    setPolling(true);
    pollAttemptsRef.current = 0;
    const tick = async () => {
      pollAttemptsRef.current += 1;
      try {
        const s = await getCheckoutStatus(sessionId);
        if (s.payment_status === "paid") {
          await refresh();
          Alert.alert(
            "Purchase complete!",
            s.skin_id ? `Unlocked ${s.skin_id} skin.` : "Skin unlocked."
          );
          setPolling(false);
          router.setParams({ session_id: undefined });
          return;
        }
        if (s.status === "expired" || pollAttemptsRef.current > 8) {
          Alert.alert(
            "Payment status",
            "Could not confirm payment. If you completed it, please refresh in a moment."
          );
          setPolling(false);
          router.setParams({ session_id: undefined });
          return;
        }
        setTimeout(tick, 2000);
      } catch {
        if (pollAttemptsRef.current > 8) {
          setPolling(false);
          router.setParams({ session_id: undefined });
          return;
        }
        setTimeout(tick, 2000);
      }
    };
    tick();
  };

  const equip = async (id: Skin["id"]) => {
    if (!progress) return;
    if (!progress.ownedSkins.includes(id)) return;
    const next = { ...progress, equippedSkin: id };
    setProgress(next);
    await saveProgress(next);
  };

  const buyPremium = async (skin: Skin) => {
    setPurchasing(skin.id);
    try {
      const outcome = await purchaseSkin(skin.id);
      if (outcome.kind === "iap_pending") {
        // native flow opened; listener will refresh state when payment succeeds
      } else if (outcome.kind === "web_redirect") {
        await WebBrowser.openBrowserAsync(outcome.url).catch(() => {});
        await refresh();
      } else if (outcome.kind === "unsupported") {
        Alert.alert("Native build required", outcome.message);
      } else if (outcome.kind === "error") {
        Alert.alert("Checkout failed", outcome.message);
      }
    } catch (e: any) {
      Alert.alert("Checkout failed", e?.message || "Please try again");
    } finally {
      setPurchasing(null);
    }
  };

  if (!progress) {
    return (
      <LinearGradient colors={["#FFDEE9", "#B5FFFC"]} style={styles.gradient}>
        <SafeAreaView style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const level = levelFromXp(progress.xp);
  const ownedCount = progress.ownedSkins.length;

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

        {polling && (
          <View style={styles.pollBanner} testID="payment-polling">
            <ActivityIndicator size="small" color="#0F172A" />
            <Text style={styles.pollText}>
              Confirming your payment…
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content}>
          {/* Collection summary + crate CTA */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>COLLECTION</Text>
              <Text style={styles.summaryValue}>
                {ownedCount} / {SKIN_LIST.length}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cratesCta}
              onPress={() => router.push("/crates")}
              testID="open-crates-from-skins"
            >
              <Ionicons name="cube" size={20} color="#FDE047" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cratesCtaTitle}>OPEN CRATES</Text>
                <Text style={styles.cratesCtaSub}>
                  {progress.crates} crate{progress.crates !== 1 ? "s" : ""} · {progress.keys} key{progress.keys !== 1 ? "s" : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FDE047" />
            </TouchableOpacity>
          </View>

          {RARITY_ORDER.map((rarity) => {
            const list = SKIN_LIST.filter((s) => s.rarity === rarity);
            if (!list.length) return null;
            return (
              <View key={rarity}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.rarityDot,
                      { backgroundColor: RARITY_COLOR[rarity] },
                    ]}
                  />
                  <Text style={styles.sectionLabel}>
                    {RARITY_LABEL[rarity].toUpperCase()}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {list.filter((s) => progress.ownedSkins.includes(s.id)).length}/
                    {list.length}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {list.map((s) => (
                    <SkinCard
                      key={s.id}
                      skin={s}
                      owned={progress.ownedSkins.includes(s.id)}
                      equipped={progress.equippedSkin === s.id}
                      onEquip={equip}
                      onBuy={buyPremium}
                      shimmerVal={shimmerVal}
                      purchasing={purchasing === s.id}
                    />
                  ))}
                </View>
              </View>
            );
          })}

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
  onBuy,
  shimmerVal,
  purchasing,
}: {
  skin: Skin;
  owned: boolean;
  equipped: boolean;
  onEquip: (id: Skin["id"]) => void;
  onBuy: (s: Skin) => void;
  shimmerVal: number;
  purchasing: boolean;
}) {
  const locked = !owned;
  const isPremium = skin.type === "premium";

  const handlePress = () => {
    if (owned && !equipped) {
      onEquip(skin.id);
    } else if (!owned && isPremium) {
      onBuy(skin);
    }
  };

  const rarityColor = RARITY_COLOR[skin.rarity];

  return (
    <TouchableOpacity
      activeOpacity={isPremium || owned ? 0.85 : 1}
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        locked && styles.cardLocked,
        { borderColor: locked ? "#0F172A" : rarityColor, borderWidth: locked ? 2 : 2.5 },
      ]}
      onPress={handlePress}
      testID={`skin-card-${skin.id}`}
    >
      <View
        style={[
          styles.rarityBadge,
          { backgroundColor: rarityColor },
        ]}
      >
        <Text style={styles.rarityBadgeText}>
          {RARITY_LABEL[skin.rarity].toUpperCase()}
        </Text>
      </View>
      {isPremium && (
        <View style={styles.premiumBadge}>
          <Ionicons name="diamond" size={9} color="#0F172A" />
          <Text style={styles.premiumBadgeText}>$</Text>
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
      {purchasing ? (
        <View style={styles.equipChip}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : locked && isPremium ? (
        <View
          style={[styles.equipChip, { backgroundColor: "#FDE047" }]}
          testID={`buy-chip-${skin.id}`}
        >
          <Text style={[styles.equipText, { color: "#0F172A" }]}>
            BUY $2.99
          </Text>
        </View>
      ) : locked ? (
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
  pollBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#A5F3FC",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 12,
    marginHorizontal: 18,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pollText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 13,
  },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
    color: "#0F172A",
    opacity: 0.7,
  },
  summaryValue: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  cratesCta: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0F172A",
    borderColor: "#FDE047",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cratesCtaTitle: {
    color: "#FDE047",
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 13,
  },
  cratesCtaSub: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontSize: 11,
    opacity: 0.85,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  rarityDot: { width: 10, height: 10, borderRadius: 5 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#0F172A",
  },
  sectionCount: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    opacity: 0.55,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    minHeight: 200,
    position: "relative",
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
    fontSize: 15,
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
  rarityBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    zIndex: 2,
  },
  rarityBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#0F172A",
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
