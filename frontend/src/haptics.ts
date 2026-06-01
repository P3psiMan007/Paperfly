// Haptics helper — a single gate for all vibration in the app.
//
// Two reasons every haptic should route through here (research §3.3 / §8 +
// audit 2.5.4):
//   1. A user setting can turn haptics off (accessibility + battery + taste).
//   2. Haptics are native-only; web must no-op rather than throw.
//
// Mirrors the shape of audio.ts: a cached `enabled` flag hydrated from storage,
// plus thin wrappers around expo-haptics that swallow errors.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@paperfly_haptics_enabled";

let enabled = true;

export async function loadHapticsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw !== null) enabled = raw === "1";
  } catch {}
  return enabled;
}

export async function setHapticsEnabled(v: boolean): Promise<void> {
  enabled = v;
  try {
    await AsyncStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

function ok(): boolean {
  return enabled && Platform.OS !== "web";
}

// Light tick for routine UI (button presses, countdown beats, slider).
export function hSelection(): void {
  if (ok()) Haptics.selectionAsync().catch(() => {});
}

// Physical impact — collisions, shield breaks, score milestones.
export function hImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
): void {
  if (ok()) Haptics.impactAsync(style).catch(() => {});
}

// State-change notification — game over (Error), milestones (Success),
// phase shifts (Warning).
export function hNotify(type: Haptics.NotificationFeedbackType): void {
  if (ok()) Haptics.notificationAsync(type).catch(() => {});
}

// Re-export the enums so callers don't also need to import expo-haptics.
export const ImpactStyle = Haptics.ImpactFeedbackStyle;
export const NotifyType = Haptics.NotificationFeedbackType;
