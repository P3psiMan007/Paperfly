import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PaperPlane from "./PaperPlane";

type Step = {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const STEPS: Step[] = [
  {
    title: "Tilt to Steer",
    body: "Tilt your phone left/right to fly sideways, and forward/back to climb or descend.",
    icon: "phone-portrait-outline",
    color: "#A5F3FC",
  },
  {
    title: "Calibrate First",
    body: "Hold your phone in your natural play pose and tap Calibrate. That pose becomes your new neutral.",
    icon: "compass-outline",
    color: "#FDE047",
  },
  {
    title: "Boost & Brake",
    body: "Tap & hold the screen to boost. Swipe down to brake. Fly through golden rings, dodge the storm clouds.",
    icon: "flash",
    color: "#FBA5C5",
  },
];

const { width: SW } = Dimensions.get("window");

export default function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (i !== page) setPage(i);
  };

  const next = () => {
    if (page < STEPS.length - 1) {
      scrollRef.current?.scrollTo({ x: SW * (page + 1), animated: true });
      setPage(page + 1);
    } else {
      onDone();
    }
  };

  return (
    <View style={styles.wrap} testID="tutorial-overlay">
      <View style={styles.panel}>
        <View style={styles.planeBox}>
          <PaperPlane size={120} tilt={-0.15} pitch={0.05} />
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ width: SW - 60 }}
        >
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.page, { width: SW - 60 }]}>
              <View
                style={[styles.iconCircle, { backgroundColor: s.color }]}
              >
                <Ionicons name={s.icon} size={28} color="#0F172A" />
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            onPress={onDone}
            style={styles.skipBtn}
            testID="tutorial-skip"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={next}
            style={styles.nextBtn}
            testID="tutorial-next"
          >
            <Text style={styles.nextText}>
              {page === STEPS.length - 1 ? "GOT IT" : "NEXT"}
            </Text>
            <Ionicons
              name={page === STEPS.length - 1 ? "checkmark" : "arrow-forward"}
              size={18}
              color="#0F172A"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 22,
    width: SW - 36,
    alignItems: "center",
  },
  planeBox: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  page: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: "#0F172A",
    opacity: 0.75,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 20,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(15,23,42,0.2)",
  },
  dotActive: {
    backgroundColor: "#0F172A",
    width: 22,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    width: "100%",
    justifyContent: "space-between",
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  skipText: {
    fontWeight: "800",
    color: "#0F172A",
    opacity: 0.6,
    fontSize: 14,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDE047",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  nextText: {
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 14,
    letterSpacing: 1,
  },
});
