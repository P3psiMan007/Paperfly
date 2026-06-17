// Game-wide constants & types for Paper Fly.
// Keeping these in one tiny module makes them easy to tweak/balance.

import type { SkinId, AchievementId } from "../skins";

// World / projection
export const FOCAL = 320;
export const FAR_Z = 1100;
export const SPAWN_Z = 1000;

// Plane
export const PLANE_SIZE = 76;
export const PLANE_X_RANGE = 220;
export const PLANE_Y_RANGE = 170;

// Speed envelope (world units per second)
export const BASE_SPEED = 380;
export const BOOST_SPEED = 680;
export const BRAKE_SPEED = 180;

// AsyncStorage keys (kept with legacy @mmf_ prefix so existing saves migrate cleanly)
export const TUTORIAL_KEY = "@mmf_tutorial_seen";

export type WorldObj = {
  id: number;
  type: "ring" | "obstacle";
  x: number;
  y: number;
  z: number;
  baseSize: number;
  collected?: boolean;
  hue?: string;
};

export type GameState = "ready" | "playing" | "paused" | "gameover";

// Which skins unlock from which achievements / levels.
// Kept here (not in skins.ts) so we don't create a circular dependency with progression.
export const SKIN_BY_ACHIEVEMENT: Partial<Record<SkinId, AchievementId>> = {
  mint: "rings_25",
};

export const SKINS_BY_LEVEL: { id: SkinId; level: number }[] = [
  { id: "skyblue", level: 3 },
  { id: "crimson", level: 8 },
];
