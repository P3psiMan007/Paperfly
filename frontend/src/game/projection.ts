// World/projection constants for the 2.5D gameplay scene.
// Kept in their own module so any code (collision, render, spawn) can reach
// them without dragging in the whole game screen.

export const FOCAL = 320;
export const FAR_Z = 1100;
export const SPAWN_Z = 1000;
export const PLANE_SIZE = 76;
export const BASE_SPEED = 380;
export const BOOST_SPEED = 680;
export const BRAKE_SPEED = 180;
export const PLANE_X_RANGE = 220;
export const PLANE_Y_RANGE = 170;

export type PowerupKind = "shield" | "magnet" | "slowmo";

export type WorldObj = {
  id: number;
  type: "ring" | "obstacle" | "powerup";
  x: number;
  y: number;
  z: number;
  baseSize: number;
  collected?: boolean;
  hue?: string;
  // For type === "powerup": which effect collecting it grants.
  powerup?: PowerupKind;
  // For type === "obstacle": optional lateral world-units-per-second drift.
  // Positive = drifting right, negative = drifting left, undefined = static.
  vx?: number;
  // If true the obstacle will split into two smaller pieces when it reaches
  // a close-range threshold (z < 250) and then never splits again.
  willSplit?: boolean;
  hasSplit?: boolean;
};

// Durations (ms) each powerup stays active after pickup.
export const POWERUP_DURATIONS: Record<PowerupKind, number> = {
  shield: 0, // shield is one-shot, not time-limited
  magnet: 6000,
  slowmo: 4500,
};

// Display labels / colors. Single source of truth so the HUD and the
// in-world icon agree.
export const POWERUP_THEME: Record<
  PowerupKind,
  { label: string; color: string; icon: string }
> = {
  shield: { label: "SHIELD", color: "#A5F3FC", icon: "shield-half" },
  magnet: { label: "MAGNET", color: "#FBA5C5", icon: "magnet" },
  slowmo: { label: "SLOW-MO", color: "#C4B5FD", icon: "hourglass" },
};

export type GameState = "ready" | "playing" | "paused" | "gameover";
