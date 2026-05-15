// Small visual subcomponents extracted from app/game.tsx. None of them own
// game state — they just take props and render. Keep that contract so the
// game loop never has to import them or worry about their re-render cost.
import React from "react";
import { View, StyleSheet } from "react-native";

export function TiltIndicator({
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

export function BoostLines({ SW, SH }: { SW: number; SH: number }) {
  const lines = Array.from({ length: 10 });
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {lines.map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const top = 60 + ((i * 73) % (SH - 200));
        return (
          <View
            key={i}
            style={[
              styles.boostLine,
              {
                top,
                left: side === -1 ? 10 : SW - 90,
                opacity: 0.55,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function ParallaxClouds({
  offset,
  tiltX,
  tiltY,
  SW,
  SH,
}: {
  offset: number;
  tiltX: number;
  tiltY: number;
  SW: number;
  SH: number;
}) {
  const layers = [
    { speed: 0.4, y: SH * 0.15, size: 110, count: 4, opacity: 0.55 },
    { speed: 0.7, y: SH * 0.32, size: 80, count: 5, opacity: 0.7 },
    { speed: 1.0, y: SH * 0.78, size: 130, count: 3, opacity: 0.8 },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      {layers.map((layer, li) =>
        Array.from({ length: layer.count }).map((_, i) => {
          const spacing = SW / layer.count + 80;
          const baseX =
            i * spacing - ((offset * layer.speed) % (SW + 200)) - 100;
          const x = baseX - tiltX * 30 * layer.speed;
          const y = layer.y - tiltY * 20 * layer.speed;
          return (
            <View
              key={`${li}-${i}`}
              style={[
                styles.cloud,
                {
                  width: layer.size,
                  height: layer.size * 0.45,
                  borderRadius: layer.size,
                  left:
                    ((x % (SW + 200)) + (SW + 200)) % (SW + 200) - 100,
                  top: y,
                  opacity: layer.opacity,
                },
              ]}
            />
          );
        })
      )}
    </View>
  );
}

export function Overlay({
  children,
  SW,
}: {
  children: React.ReactNode;
  SW: number;
}) {
  return (
    <View style={[styles.overlayWrap, { pointerEvents: "box-none" }]}>
      <View style={[styles.overlayPanel, { width: SW - 60 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: { position: "absolute", backgroundColor: "#FFFFFF" },
  boostLine: {
    position: "absolute",
    width: 80,
    height: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
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
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.25)",
  },
  overlayPanel: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#0F172A",
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
  },
});
