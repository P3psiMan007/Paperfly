// Reveal — fades + slides its children up into place after an optional delay.
// Used to stagger the game-over unlock reveals (audit 2.4.3) so level-ups and
// skin unlocks arrive as little beats instead of all at once. Native-driven.
import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

type Props = {
  children: React.ReactNode;
  // ms before this item animates in.
  delay?: number;
  // Re-trigger when this changes (e.g. a new run).
  trigger?: number | string;
  distance?: number;
};

export function Reveal({ children, delay = 0, trigger, distance = 14 }: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    v.setValue(0);
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, delay]);

  const translateY = v.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
