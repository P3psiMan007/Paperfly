import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  size?: number;
  tilt?: number; // -1..1 for roll visual
  pitch?: number; // -1..1 for pitch visual
};

// Origami-style paper plane built from layered triangle Views.
export default function PaperPlane({ size = 80, tilt = 0, pitch = 0 }: Props) {
  const rotateZ = `${tilt * 25}deg`;
  const rotateX = `${pitch * 15}deg`;
  const w = size;
  const h = size * 0.9;
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
      {/* Shadow */}
      <View
        style={[
          styles.shadow,
          { width: w * 0.6, height: h * 0.18, top: h * 0.95 },
        ]}
      />
      {/* Right wing (darker) */}
      <View
        style={[
          styles.wingRight,
          {
            borderLeftWidth: w * 0.5,
            borderRightWidth: 0,
            borderBottomWidth: h,
          },
        ]}
      />
      {/* Left wing (lighter) */}
      <View
        style={[
          styles.wingLeft,
          {
            borderLeftWidth: 0,
            borderRightWidth: w * 0.5,
            borderBottomWidth: h,
          },
        ]}
      />
      {/* Center fold line */}
      <View style={[styles.fold, { height: h * 0.95, left: w * 0.5 - 0.75 }]} />
      {/* Tail accent triangle */}
      <View
        style={[
          styles.tail,
          {
            borderLeftWidth: w * 0.18,
            borderRightWidth: w * 0.18,
            borderBottomWidth: h * 0.32,
            top: h * 0.55,
            left: w * 0.5 - w * 0.18,
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
    backgroundColor: "rgba(15,23,42,0.18)",
    borderRadius: 999,
  },
  wingLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "#FFFFFF",
    borderBottomColor: "transparent",
    borderTopColor: "transparent",
  },
  wingRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderTopColor: "transparent",
  },
  fold: {
    position: "absolute",
    width: 1.5,
    backgroundColor: "#0F172A",
    top: 0,
    opacity: 0.55,
  },
  tail: {
    position: "absolute",
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#CBD5E1",
    borderTopColor: "transparent",
  },
});
