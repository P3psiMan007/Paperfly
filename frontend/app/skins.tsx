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
} from "../src/skins";
import {
  createCheckoutSession,
  getCheckoutStatus,
  getOwnedSkins,
} from "../src/api";

export default function Skins() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string; cancelled?: string }>();
  const [progress, setProgress] = useState<Progress | null>(null);
  const shimmer = useMemo(() => new Animated.Value(0), []);
  const [shimmerVal, setShimmerVal] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollAttemptsRef = useRef(0);

  const refresh = useCallback(async () => {
    const p = await loadProgress();
    // Sync owned premium skins from backend
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

  // Handle return from Stripe checkout
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
      const origin =
        (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") ||
        "https://example.com";
      const { url } = await createCheckoutSession(skin.id, origin);
      // Open Stripe Checkout in an in-app browser; on success we land back at /skins?session_id=...
      const result = await WebBrowser.openBrowserAsync(url);
      // After browser closes, refresh state (in case we already handle redirect via deep link)
      if (result.type === "cancel" || result.type === "dismiss") {
        // Best-effort: poll once via getOwnedSkins
        await refresh();
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
              Confirming your payment with Stripe…
            </Text>
          </View>
        )}

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
                onBuy={buyPremium}
                shimmerVal={shimmerVal}
                purchasing={purchasing === s.id}
              />
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
            PREMIUM · $2.99 EACH
          </Text>
          <View style={styles.grid}>
            {SKIN_LIST.filter((s) => s.type === "premium").map((s) => (
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

  return (
    <TouchableOpacity
      activeOpacity={isPremium || owned ? 0.85 : 1}
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        locked && styles.cardLocked,
      ]}
      onPress={handlePress}
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
      {purchasing ? (
        <View style={styles.equipChip}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : locked && isPremium ? (
        <View
          style={[styles.equipChip, { backgroundColor: "#FDE047" }]}
          testID={`buy-chip-${skin.id}`}
        >
          <Text style={[styles.equipText, { color: "#0F172A" }]}>BUY $2.99</Text>
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
  content: { padding: 18, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#0F172A",
    opacity: 0.7,
    marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
