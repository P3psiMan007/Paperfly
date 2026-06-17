import React from "react";
import { View, StyleSheet } from "react-native";

export default function TiltIndicator({
  tiltX,
  tiltY,
}: {
  tiltX: number;
  tiltY: number;
}) {
  const dotX = 22 + tiltX * 18;
  const dotY = 22 + tiltY * 18;
  return (
    <View style={styles.tiltIndicator} testID="tilt-indicator">
      <View style={styles.tiltCross} />
      <View style={styles.tiltCrossV} />
      <View style={[styles.tiltDot, { left: dotX - 6, top: dotY - 6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tiltIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tiltCross: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  tiltCrossV: {
    position: "absolute",
    height: "70%",
    width: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  tiltDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FDE047",
    borderWidth: 1.5,
    borderColor: "#0F172A",
  },
});
