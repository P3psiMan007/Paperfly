import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  size?: number;
  tilt?: number; // -1..1 for roll visual
  pitch?: number; // -1..1 for pitch visual
};

// Origami-style paper plane: two stacked triangles + a small tail fin.
// Built entirely from styled Views so it works on iOS / Android / web.
export default function PaperPlane({ size = 80, tilt = 0, pitch = 0 }: Props) {
  const rotateZ = `${tilt * 22}deg`;
  const rotateX = `${pitch * 14}deg`;
  const w = size;
  const h = size;

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: w,
          height: h,
          transform: [{ perspective: 600 }, { rotateZ }, { rotateX }],
        },
      ]}
    >
      {/* Soft drop shadow under plane */}
      <View
        style={[
          styles.shadow,
          {
            width: w * 0.55,
            height: w * 0.12,
            top: h * 0.92,
            left: (w - w * 0.55) / 2,
          },
        ]}
      />

      {/* Main body: large white triangle pointing UP (nose up) */}
      <View
        style={[
          styles.bodyTri,
          {
            borderLeftWidth: w * 0.5,
            borderRightWidth: w * 0.5,
            borderBottomWidth: h * 0.95,
          },
        ]}
      />

      {/* Right wing shadow (slightly darker triangle on right half) */}
      <View
        style={[
          styles.wingShadow,
          {
            borderLeftWidth: w * 0.5,
            borderRightWidth: 0,
            borderBottomWidth: h * 0.95,
          },
        ]}
      />

      {/* Center fold line (nose to tail) */}
      <View
        style={[
          styles.fold,
          { height: h * 0.95, left: w * 0.5 - 1 },
        ]}
      />

      {/* Tail fin: small dark triangle at bottom-center */}
      <View
        style={[
          styles.tailFin,
          {
            borderLeftWidth: w * 0.16,
            borderRightWidth: w * 0.16,
            borderTopWidth: h * 0.22,
            top: h * 0.78,
            left: w * 0.5 - w * 0.16,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    position: "absolute",
    backgroundColor: "rgba(15,23,42,0.22)",
    borderRadius: 999,
  },
  bodyTri: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
  },
  wingShadow: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderLeftColor: "#CBD5E1",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderTopColor: "transparent",
  },
  fold: {
    position: "absolute",
    width: 2,
    backgroundColor: "#0F172A",
    top: 0,
    opacity: 0.85,
  },
  tailFin: {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0F172A",
    borderBottomColor: "transparent",
    opacity: 0.9,
  },
});
