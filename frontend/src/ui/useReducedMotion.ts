// useReducedMotion — true when the OS "Reduce Motion" accessibility setting is
// on. Big scale pops, confetti, flashes and ambient loops should soften or skip
// when this is set (research §8 / audit Section 4). Listens for live changes.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduced(v)
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
