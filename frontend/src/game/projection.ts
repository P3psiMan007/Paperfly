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
