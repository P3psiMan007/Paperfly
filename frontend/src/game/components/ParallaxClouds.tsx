import React from "react";
import { View, StyleSheet } from "react-native";

export default function ParallaxClouds({
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

const styles = StyleSheet.create({
  cloud: { position: "absolute", backgroundColor: "#FFFFFF" },
});
