// Confetti — a one-shot celebration burst for the game-over "new best" moment
// (audit 2.4.4). Plain Animated Views, no Reanimated/Skia, native-driven
// transforms so it stays cheap. Mounts, plays once, fades out.
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Easing } from "react-native";
import { COLORS } from "../theme";

const PIECE_COLORS = [
  COLORS.accent,
  COLORS.cyan,
  COLORS.purple,
  COLORS.dangerRose,
  COLORS.success,
  COLORS.white,
];

type Props = {
  // Width of the area to scatter across (usually the overlay panel width).
  width: number;
  count?: number;
  // Re-fires the burst whenever this value changes (e.g. a run id).
  trigger?: number | string;
};

export function Confetti({ width, count = 28, trigger }: Props) {
  // Per-piece animated progress 0→1. Created once.
  const pieces = useRef(
    Array.from({ length: count }).map(() => ({
      progress: new Animated.Value(0),
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 120,
      fall: 220 + Math.random() * 180,
      rotate: (Math.random() - 0.5) * 6,
      size: 7 + Math.random() * 7,
      color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
      delay: Math.random() * 250,
    }))
  ).current;

  useEffect(() => {
    const anims = pieces.map((p) => {
      p.progress.setValue(0);
      return Animated.timing(p.progress, {
        toValue: 1,
        duration: 1400,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    });
    Animated.parallel(anims).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, p.fall],
        });
        const translateX = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.drift],
        });
        const rotate = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${p.rotate * 180}deg`],
        });
        const opacity = p.progress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.4,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
