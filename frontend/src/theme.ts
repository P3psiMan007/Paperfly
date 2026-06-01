// Design tokens — the single source of truth for Paper Fly's visual system.
//
// Why this exists: colors, radii, spacing and shadow values were previously
// hard-coded across index.tsx, settings.tsx, skins.tsx and game.tsx, which made
// the look drift screen-to-screen and any rebrand a find-and-replace slog. New
// components import from here; existing screens are migrated incrementally.
//
// The palette is the neo-brutalist + soft-pastel system from
// design_guidelines.json: a dark "ink" outline on everything, saturated accents
// for actions, pastel gradients for the world.

export const COLORS = {
  // Ink — the universal outline + text color. Neo-brutalist black-blue.
  ink: "#0F172A",
  inkSoft: "rgba(15,23,42,0.6)",
  inkFaint: "rgba(15,23,42,0.12)",

  // Surfaces (menu cards sit on the pastel gradient at partial opacity).
  surface: "rgba(255,255,255,0.78)",
  surfaceSolid: "#FFFFFF",
  surfaceStrong: "rgba(255,255,255,0.95)",

  // Brand accent — the golden ring / primary CTA color.
  accent: "#FDE047",
  accentDeep: "#D97706",

  // Secondary action / daily / calm UI.
  cyan: "#A5F3FC",

  // Rare-tier / premium accent.
  purple: "#A78BFA",
  purpleSoft: "#C4B5FD",

  // Danger — obstacles + destructive actions. Saturated, not pastel.
  danger: "#DC2626",
  dangerRose: "#E11D48",

  // Warning — splitter telegraph.
  warn: "#FB923C",
  warnDeep: "#7C2D12",

  // Positive — new best / success states.
  success: "#22C55E",

  // Home/menu background gradient (top-left → bottom-right).
  bgGradient: ["#FFDEE9", "#FFE3B5", "#B5FFFC"] as const,
  // Two-stop variant used by sub-screens.
  bgGradientShort: ["#FFDEE9", "#B5FFFC"] as const,

  white: "#FFFFFF",
} as const;

// Corner radii. Neo-brutalist = generous but not pill-everything.
export const RADII = {
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

// 4-pt spacing scale.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Border width — the defining neo-brutalist trait.
export const BORDER = {
  width: 2,
  widthThick: 3,
} as const;

// The neo-brutalist "hard shadow": a solid ink block offset down, no blur.
// Buttons render this as a sibling View behind them so the press animation
// can collapse the offset (button pushes down onto its shadow).
export const SHADOW = {
  // Offset in px the raised element floats above its hard shadow.
  offset: 4,
  color: COLORS.ink,
} as const;

// Font family tokens. Currently mapped to the platform default (undefined =
// system font) so the app works with zero font assets. When display/body
// fonts are added (see docs/audit — expo-font + a display + UI sans), swap the
// values here and every screen picks them up. Weight is still set per-style.
export const FONTS = {
  display: undefined as string | undefined, // titles, score, big numbers
  body: undefined as string | undefined, // labels, paragraphs
} as const;

// Standard one-shot reaction timings (ms). Centralized so juice across the app
// shares a cadence. See docs/research/game-feel-best-practices.md.
export const TIMING = {
  pressIn: 90, // button depress
  pop: 320, // scale-pop settle (1.1→1.0)
  flash: 350, // HUD/score flash window
  phaseFlash: 600, // full-screen environment flash
  countUp: 1200, // game-over score count-up
  notifIn: 200,
  notifHold: 3000,
  notifOut: 300,
} as const;
