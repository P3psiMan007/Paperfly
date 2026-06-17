import React from "react";
import { View, StyleSheet } from "react-native";

export default function BoostLines({
  SW,
  SH,
}: {
  SW: number;
  SH: number;
}) {
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

const styles = StyleSheet.create({
  boostLine: {
    position: "absolute",
    width: 80,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#FDE047",
  },
});
