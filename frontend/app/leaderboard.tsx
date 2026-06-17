import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDailyLeaderboard, LeaderboardEntry } from "../src/api";
import { getDeviceId } from "../src/device";
import { todaySeedString } from "../src/daily";

export default function Leaderboard() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string>("");
  const seed = todaySeedString();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const did = await getDeviceId();
      setMyDeviceId(did);
      const res = await getDailyLeaderboard(seed);
      setEntries(res.entries || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [seed]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <LinearGradient colors={["#FFDEE9", "#B5FFFC"]} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="leaderboard-back"
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Top 50</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.seedBadge}>
          <Ionicons name="calendar" size={12} color="#0F172A" />
          <Text style={styles.seedText}>SEED · {seed}</Text>
          <Text style={styles.seedText}>· {total} players</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} />
          }
        >
          {loading && !entries.length && (
            <View style={styles.empty}>
              <ActivityIndicator color="#0F172A" />
              <Text style={styles.emptyText}>Loading leaderboard…</Text>
            </View>
          )}
          {!loading && error && (
            <View style={styles.empty}>
              <Ionicons name="alert-circle" size={24} color="#B91C1C" />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          )}
          {!loading && !error && entries.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={28} color="#0F172A" />
              <Text style={styles.emptyText}>
                No scores yet today. Set the pace!
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: "/game", params: { daily: "1" } })}
              >
                <Ionicons name="play" size={18} color="#0F172A" />
                <Text style={styles.actionBtnText}>Play Daily Challenge</Text>
              </TouchableOpacity>
            </View>
          )}

          {entries.map((e, i) => (
            <View
              key={`${e.device_id}-${i}`}
              style={[
                styles.row,
                e.device_id === myDeviceId && styles.rowMine,
                i === 0 && styles.rowGold,
                i === 1 && styles.rowSilver,
                i === 2 && styles.rowBronze,
              ]}
              testID={`lb-row-${i}`}
            >
              <Text style={styles.rank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {e.name || "Anonymous"}
                  {e.device_id === myDeviceId ? "  (you)" : ""}
                </Text>
                <Text style={styles.sub}>{e.rings} rings</Text>
              </View>
              <Text style={styles.score}>{e.score}</Text>
            </View>
          ))}
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
  seedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
  },
  seedText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0F172A",
  },
  content: { padding: 18, gap: 8, paddingBottom: 60 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
  },
  rowMine: { backgroundColor: "#FDE047" },
  rowGold: { backgroundColor: "#FEF08A" },
  rowSilver: { backgroundColor: "#E2E8F0" },
  rowBronze: { backgroundColor: "#FED7AA" },
  rank: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    width: 44,
  },
  name: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  sub: { fontSize: 11, fontWeight: "700", color: "#0F172A", opacity: 0.65 },
  score: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  actionBtnText: { fontWeight: "900", color: "#0F172A", letterSpacing: 0.5 },
});
