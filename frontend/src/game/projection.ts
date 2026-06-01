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

// How far (px) the plane sprite slides from screen center per unit of tilt.
// Equal on both axes so left/right and up/down feel the same — the real cause
// of weak/asymmetric steering was a pre-calibration clamp in the sensor
// handler (since fixed), not the gain. Both render and collision import these
// so the plane you see is exactly the plane that collides.
export const ROLL_SCREEN_GAIN = 100;
export const PITCH_SCREEN_GAIN = 100;

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
  // Visual variant assigned at spawn time for standard obstacles. Drives
  // which inner glyph (chevron / warning) is drawn and whether the
  // silhouette is rotated 45° (lozenge). Pending splitters override this
  // and always show the hot-orange + X-marker treatment.
  //   0 = chevron arrows, 1 = warning icon, 2 = lozenge / diamond.
  variant?: 0 | 1 | 2;
  // For type === "obstacle": minimum screen-space distance between the
  // plane center and this obstacle's center, tracked while in the
  // collision window (z < 80). Used by the near-miss bonus once z drops
  // below 30 — a close-but-not-hit pass awards +25.
  closestDist?: number;
  // For type === "obstacle": set true after the near-miss check has been
  // resolved (either awarded or skipped). Prevents re-firing as z keeps
  // dropping toward the cull threshold.
  passed?: boolean;
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
