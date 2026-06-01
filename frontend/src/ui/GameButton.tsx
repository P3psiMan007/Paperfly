// GameButton — the one button the whole app uses.
//
// Replaces the bare TouchableOpacity (opacity-fade only) pattern that made
// every CTA feel flat. Gives the player the four things a touch-game button
// owes them (see docs/research/game-feel-best-practices.md §3):
//   1. Affordance  — neo-brutalist ink border + a hard offset shadow so it
//      reads as physically raised.
//   2. Press feedback — the button translates down onto its shadow (the
//      "push-in" skeuomorphic press), far stronger than an opacity fade.
//   3. Haptic — a selection tick fires on press-in, at the instant of the
//      visual depression (timing matters; a late haptic feels wrong).
//   4. Size — meets the 44pt (iOS) / 48dp (Android) minimum touch target.
//
// Also handles disabled (dimmed, no shadow, inert) and loading (spinner in
// place of the icon, width held constant so the row doesn't reflow) states,
// and always carries an accessibility label/role.
import React, { useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hSelection } from "../haptics";
import { COLORS, RADII, BORDER, SHADOW, FONTS } from "../theme";

export type GameButtonVariant =
  | "primary" // golden accent — one per screen
  | "cyan" // secondary action (daily, etc.)
  | "secondary" // neutral surface
  | "ghost" // low-emphasis, no shadow
  | "danger"; // destructive

export type GameButtonSize = "lg" | "md" | "sm";

type Props = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  // Fill available width in a row (flex: 1).
  flex?: boolean;
  // Defaults to `label`. Set when the visible text is too terse for SR users.
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  // Pulse the button (used by the game-over "tap to retry" nudge). When true
  // the button gently breathes to invite a tap.
  pulse?: boolean;
};

const VARIANT_FILL: Record<GameButtonVariant, string> = {
  primary: COLORS.accent,
  cyan: COLORS.cyan,
  secondary: COLORS.surface,
  ghost: "rgba(255,255,255,0.55)",
  danger: COLORS.danger,
};

const VARIANT_TEXT: Record<GameButtonVariant, string> = {
  primary: COLORS.ink,
  cyan: COLORS.ink,
  secondary: COLORS.ink,
  ghost: COLORS.ink,
  danger: COLORS.white,
};

const SIZE_PAD: Record<GameButtonSize, { v: number; font: number; icon: number }> = {
  lg: { v: 16, font: 18, icon: 22 },
  md: { v: 13, font: 15, icon: 18 },
  sm: { v: 10, font: 13, icon: 16 },
};

export function GameButton({
  label,
  onPress,
  icon,
  variant = "secondary",
  size = "md",
  disabled = false,
  loading = false,
  loadingLabel,
  flex = false,
  accessibilityLabel,
  testID,
  style,
  pulse = false,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const inert = disabled || loading;
  const hasShadow = variant !== "ghost";
  const sz = SIZE_PAD[size];
  const fill = VARIANT_FILL[variant];
  const textColor = VARIANT_TEXT[variant];

  // Gentle breathing pulse for the retry-nudge. Drives scale only, native.
  const pulseVal = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!pulse) {
      pulseVal.stopAnimation();
      pulseVal.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseVal, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(pulseVal, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseVal]);
  const pulseScale = pulseVal.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  // How far the button rides above its shadow. Collapses to 0 on press.
  const lift = hasShadow ? SHADOW.offset : 0;
  const translateY = pressed && !inert ? lift : 0;

  return (
    <Animated.View
      style={[
        flex && styles.flex,
        { transform: [{ scale: pulseScale }] },
        style,
      ]}
    >
      <View style={{ paddingBottom: lift }}>
        {hasShadow && (
          <View
            pointerEvents="none"
            style={[
              styles.shadow,
              {
                top: lift,
                borderRadius: RADII.xl,
                opacity: inert ? 0 : 1,
              },
            ]}
          />
        )}
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: inert, busy: loading }}
          disabled={inert}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPressIn={() => {
            if (inert) return;
            setPressed(true);
            hSelection();
          }}
          onPressOut={() => setPressed(false)}
          onPress={() => {
            if (inert) return;
            onPress();
          }}
          style={[
            styles.button,
            {
              backgroundColor: fill,
              borderRadius: RADII.xl,
              paddingVertical: sz.v,
              opacity: disabled ? 0.5 : 1,
              transform: [{ translateY }],
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            icon && <Ionicons name={icon} size={sz.icon} color={textColor} />
          )}
          <Text
            style={[
              styles.label,
              { color: textColor, fontSize: sz.font, fontFamily: FONTS.display },
            ]}
            numberOfLines={1}
          >
            {loading ? loadingLabel ?? label : label}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SHADOW.color,
  },
  button: {
    borderWidth: BORDER.width,
    borderColor: COLORS.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontWeight: "900",
    letterSpacing: 1,
  },
});
