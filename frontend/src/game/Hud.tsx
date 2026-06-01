// Small visual subcomponents extracted from app/game.tsx. None of them own
// game state — they just take props and render. Keep that contract so the
// game loop never has to import them or worry about their re-render cost.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { POWERUP_THEME, POWERUP_DURATIONS } from "./projection";

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
  cloudColor = "#FFFFFF",
}: {
  offset: number;
  tiltX: number;
  tiltY: number;
  SW: number;
  SH: number;
  cloudColor?: string;
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
                  backgroundColor: cloudColor,
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

// Stacks one badge per active powerup. Magnet/slowmo show a tiny seconds
// countdown so the player can plan the next move. We tick our own setState
// at 5 Hz so the countdown numbers update without coupling to the game loop.
export function PowerupHud({
  shieldActive,
  magnetUntil,
  slowmoUntil,
}: {
  shieldActive: boolean;
  magnetUntil: number;
  slowmoUntil: number;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!magnetUntil && !slowmoUntil) return;
    const id = setInterval(() => force((n) => (n + 1) % 1e6), 200);
    return () => clearInterval(id);
  }, [magnetUntil, slowmoUntil]);

  const now = Date.now();
  const items: {
    key: string;
    label: string;
    color: string;
    icon: string;
    secs?: number;
    // Fraction of the effect's duration still remaining (0..1) for timed
    // power-ups; drives the depleting bar. Undefined for the one-shot shield.
    frac?: number;
  }[] = [];
  if (shieldActive) {
    items.push({
      key: "shield",
      label: POWERUP_THEME.shield.label,
      color: POWERUP_THEME.shield.color,
      icon: POWERUP_THEME.shield.icon,
    });
  }
  if (magnetUntil > now) {
    items.push({
      key: "magnet",
      label: POWERUP_THEME.magnet.label,
      color: POWERUP_THEME.magnet.color,
      icon: POWERUP_THEME.magnet.icon,
      secs: Math.ceil((magnetUntil - now) / 1000),
      frac: Math.max(
        0,
        Math.min(1, (magnetUntil - now) / POWERUP_DURATIONS.magnet)
      ),
    });
  }
  if (slowmoUntil > now) {
    items.push({
      key: "slowmo",
      label: POWERUP_THEME.slowmo.label,
      color: POWERUP_THEME.slowmo.color,
      icon: POWERUP_THEME.slowmo.icon,
      secs: Math.ceil((slowmoUntil - now) / 1000),
      frac: Math.max(
        0,
        Math.min(1, (slowmoUntil - now) / POWERUP_DURATIONS.slowmo)
      ),
    });
  }
  if (items.length === 0) return null;
  return (
    <View style={styles.powerupRow} testID="powerup-row">
      {items.map((i) => (
        <View
          key={i.key}
          style={[styles.powerupPill, { backgroundColor: i.color }]}
        >
          <Ionicons name={i.icon as any} size={12} color="#0F172A" />
          <Text style={styles.powerupLabel}>{i.label}</Text>
          {typeof i.secs === "number" && (
            <Text style={styles.powerupSecs}>{i.secs}s</Text>
          )}
          {typeof i.frac === "number" && (
            <View style={styles.powerupBarTrack}>
              <View
                style={[styles.powerupBarFill, { width: `${i.frac * 100}%` }]}
              />
            </View>
          )}
        </View>
      ))}
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
  powerupRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  powerupPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 7,
    borderWidth: 2,
    borderColor: "#0F172A",
    borderRadius: 14,
    overflow: "hidden",
  },
  powerupLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 1,
  },
  powerupSecs: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0F172A",
    opacity: 0.7,
  },
  powerupBarTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(15,23,42,0.15)",
  },
  powerupBarFill: {
    height: 3,
    backgroundColor: "#0F172A",
  },
});
