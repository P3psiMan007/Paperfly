// Paper Fly — skin catalogue with rarity tiers and crate-only exotic skins.
//
// Rarity tiers (CS:GO-style):
//   common    – earned by default or via low-level play
//   rare      – earned via mid-level play or crates
//   epic      – crate-only by default
//   legendary – crate-only OR direct premium IAP purchase
//   mythic    – crate-only, ultra rare exotic

export type SkinId =
  | "origami"
  | "skyblue"
  | "mint"
  | "crimson"
  | "cardboard"
  | "sunset"
  | "forest"
  | "cobalt_storm"
  | "ice_crystal"
  | "toxic"
  | "aurora"
  | "phoenix"
  | "galaxy"
  | "solar_flare"
  | "void_dragon"
  | "nebula_phantom"
  | "celestial_emperor";

export type SkinFlair = "plain" | "shimmer" | "flame" | "galaxy";

export type SkinRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type SkinPalette = {
  wingLight: string;
  wingDark: string;
  outline: string;
  tailFin: string;
  glow?: string;
  gradient?: string[];
};

export type AchievementId =
  | "rings_25"
  | "survive_60"
  | "boost_30"
  | "score_500"
  | "first_crash";

export type SkinUnlock =
  | { kind: "default" }
  | { kind: "level"; level: number }
  | { kind: "achievement"; id: AchievementId }
  | { kind: "premium" }
  | { kind: "crate" };

export type Skin = {
  id: SkinId;
  name: string;
  tagline: string;
  type: "free" | "premium";
  rarity: SkinRarity;
  unlock: SkinUnlock;
  palette: SkinPalette;
  flair: SkinFlair;
};

export const RARITY_ORDER: SkinRarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

export const RARITY_LABEL: Record<SkinRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

export const RARITY_COLOR: Record<SkinRarity, string> = {
  common: "#94A3B8",
  rare: "#38BDF8",
  epic: "#A855F7",
  legendary: "#F59E0B",
  mythic: "#EC4899",
};

// Dust / XP refund when crate produces a duplicate skin
export const RARITY_DUST: Record<SkinRarity, number> = {
  common: 40,
  rare: 120,
  epic: 320,
  legendary: 900,
  mythic: 2600,
};

export const ACHIEVEMENTS: Record<
  AchievementId,
  { name: string; description: string }
> = {
  rings_25: {
    name: "Ring Collector",
    description: "Collect 25 rings (lifetime)",
  },
  survive_60: {
    name: "Sky Veteran",
    description: "Survive 60 seconds in a single run",
  },
  boost_30: {
    name: "Speed Demon",
    description: "Use boost 30 times (lifetime)",
  },
  score_500: {
    name: "High Flyer",
    description: "Reach 500 score in a single run",
  },
  first_crash: {
    name: "Welcome Aboard",
    description: "Survive your first crash",
  },
};

export const SKINS: Record<SkinId, Skin> = {
  // ───────────── COMMON ─────────────
  origami: {
    id: "origami",
    name: "Origami",
    tagline: "The classic paper plane",
    type: "free",
    rarity: "common",
    unlock: { kind: "default" },
    flair: "plain",
    palette: {
      wingLight: "#FFFFFF",
      wingDark: "#CBD5E1",
      outline: "#0F172A",
      tailFin: "#0F172A",
    },
  },
  skyblue: {
    id: "skyblue",
    name: "Skyliner",
    tagline: "Cool blue sky cruiser",
    type: "free",
    rarity: "common",
    unlock: { kind: "level", level: 3 },
    flair: "plain",
    palette: {
      wingLight: "#DBEAFE",
      wingDark: "#60A5FA",
      outline: "#0F172A",
      tailFin: "#1E40AF",
    },
  },
  mint: {
    id: "mint",
    name: "Mint Glider",
    tagline: "Achievement: 25 rings collected",
    type: "free",
    rarity: "common",
    unlock: { kind: "achievement", id: "rings_25" },
    flair: "plain",
    palette: {
      wingLight: "#D1FAE5",
      wingDark: "#34D399",
      outline: "#0F172A",
      tailFin: "#047857",
    },
  },
  cardboard: {
    id: "cardboard",
    name: "Cardboard",
    tagline: "Found in the recycling bin",
    type: "free",
    rarity: "common",
    unlock: { kind: "crate" },
    flair: "plain",
    palette: {
      wingLight: "#FEF3C7",
      wingDark: "#92400E",
      outline: "#451A03",
      tailFin: "#451A03",
    },
  },

  // ───────────── RARE ─────────────
  crimson: {
    id: "crimson",
    name: "Crimson Dart",
    tagline: "Reach Level 8",
    type: "free",
    rarity: "rare",
    unlock: { kind: "level", level: 8 },
    flair: "plain",
    palette: {
      wingLight: "#FEE2E2",
      wingDark: "#F87171",
      outline: "#0F172A",
      tailFin: "#991B1B",
    },
  },
  sunset: {
    id: "sunset",
    name: "Sunset Drifter",
    tagline: "Painted by the evening sky",
    type: "free",
    rarity: "rare",
    unlock: { kind: "crate" },
    flair: "shimmer",
    palette: {
      wingLight: "#FED7AA",
      wingDark: "#EA580C",
      outline: "#7C2D12",
      tailFin: "#9A3412",
      gradient: ["#FECACA", "#FB923C", "#F472B6"],
    },
  },
  forest: {
    id: "forest",
    name: "Forest Wing",
    tagline: "Moss & morning dew",
    type: "free",
    rarity: "rare",
    unlock: { kind: "crate" },
    flair: "plain",
    palette: {
      wingLight: "#BBF7D0",
      wingDark: "#15803D",
      outline: "#052E16",
      tailFin: "#14532D",
    },
  },

  // ───────────── EPIC ─────────────
  cobalt_storm: {
    id: "cobalt_storm",
    name: "Cobalt Storm",
    tagline: "Lightning in the wings",
    type: "free",
    rarity: "epic",
    unlock: { kind: "crate" },
    flair: "shimmer",
    palette: {
      wingLight: "#BFDBFE",
      wingDark: "#1D4ED8",
      outline: "#0F172A",
      tailFin: "#1E3A8A",
      glow: "#60A5FA",
      gradient: ["#1E3A8A", "#3B82F6", "#FFFFFF", "#1D4ED8"],
    },
  },
  ice_crystal: {
    id: "ice_crystal",
    name: "Ice Crystal",
    tagline: "Forged from glacier glass",
    type: "free",
    rarity: "epic",
    unlock: { kind: "crate" },
    flair: "shimmer",
    palette: {
      wingLight: "#E0F2FE",
      wingDark: "#0EA5E9",
      outline: "#0C4A6E",
      tailFin: "#0369A1",
      glow: "#7DD3FC",
      gradient: ["#F0F9FF", "#7DD3FC", "#FFFFFF", "#E0F2FE"],
    },
  },
  toxic: {
    id: "toxic",
    name: "Toxic Slime",
    tagline: "Radioactive — handle with care",
    type: "free",
    rarity: "epic",
    unlock: { kind: "crate" },
    flair: "shimmer",
    palette: {
      wingLight: "#ECFCCB",
      wingDark: "#65A30D",
      outline: "#1A2E05",
      tailFin: "#365314",
      glow: "#BEF264",
      gradient: ["#D9F99D", "#84CC16", "#FACC15", "#A3E635"],
    },
  },

  // ───────────── LEGENDARY ─────────────
  aurora: {
    id: "aurora",
    name: "Aurora",
    tagline: "Holographic shimmer",
    type: "premium",
    rarity: "legendary",
    unlock: { kind: "premium" },
    flair: "shimmer",
    palette: {
      wingLight: "#FCE7F3",
      wingDark: "#A78BFA",
      outline: "#0F172A",
      tailFin: "#7C3AED",
      glow: "#F0ABFC",
      gradient: ["#FBCFE8", "#A5F3FC", "#C4B5FD", "#FEF3C7"],
    },
  },
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    tagline: "Flame trail · burning hot",
    type: "premium",
    rarity: "legendary",
    unlock: { kind: "premium" },
    flair: "flame",
    palette: {
      wingLight: "#FFEDD5",
      wingDark: "#F97316",
      outline: "#7C2D12",
      tailFin: "#B91C1C",
      glow: "#FB923C",
      gradient: ["#FCD34D", "#F97316", "#DC2626"],
    },
  },
  galaxy: {
    id: "galaxy",
    name: "Galaxy",
    tagline: "Deep space, twinkling stars",
    type: "premium",
    rarity: "legendary",
    unlock: { kind: "premium" },
    flair: "galaxy",
    palette: {
      wingLight: "#312E81",
      wingDark: "#0F172A",
      outline: "#22D3EE",
      tailFin: "#22D3EE",
      glow: "#A78BFA",
      gradient: ["#1E1B4B", "#581C87", "#0F172A"],
    },
  },
  solar_flare: {
    id: "solar_flare",
    name: "Solar Flare",
    tagline: "A fragment of the sun itself",
    type: "free",
    rarity: "legendary",
    unlock: { kind: "crate" },
    flair: "flame",
    palette: {
      wingLight: "#FEF08A",
      wingDark: "#EAB308",
      outline: "#713F12",
      tailFin: "#A16207",
      glow: "#FACC15",
      gradient: ["#FFFBEB", "#FBBF24", "#DC2626"],
    },
  },

  // ───────────── MYTHIC ─────────────
  void_dragon: {
    id: "void_dragon",
    name: "Void Dragon",
    tagline: "Tore through the fabric of reality",
    type: "free",
    rarity: "mythic",
    unlock: { kind: "crate" },
    flair: "galaxy",
    palette: {
      wingLight: "#1E1B4B",
      wingDark: "#020617",
      outline: "#F0ABFC",
      tailFin: "#A855F7",
      glow: "#C084FC",
      gradient: ["#020617", "#581C87", "#1E1B4B", "#312E81"],
    },
  },
  nebula_phantom: {
    id: "nebula_phantom",
    name: "Nebula Phantom",
    tagline: "A whisper from the cosmos",
    type: "free",
    rarity: "mythic",
    unlock: { kind: "crate" },
    flair: "galaxy",
    palette: {
      wingLight: "#FBCFE8",
      wingDark: "#581C87",
      outline: "#FAE8FF",
      tailFin: "#C084FC",
      glow: "#F0ABFC",
      gradient: ["#FAE8FF", "#F472B6", "#A855F7", "#22D3EE"],
    },
  },
  celestial_emperor: {
    id: "celestial_emperor",
    name: "Celestial Emperor",
    tagline: "Forged by the gods of the sky",
    type: "free",
    rarity: "mythic",
    unlock: { kind: "crate" },
    flair: "galaxy",
    palette: {
      wingLight: "#FEF9C3",
      wingDark: "#CA8A04",
      outline: "#FFFBEB",
      tailFin: "#FACC15",
      glow: "#FDE047",
      gradient: ["#FFFBEB", "#FDE047", "#FCD34D", "#FFFFFF"],
    },
  },
};

export const SKIN_LIST: Skin[] = Object.values(SKINS);

export function unlockSummary(s: Skin): string {
  switch (s.unlock.kind) {
    case "default":
      return "Unlocked";
    case "level":
      return `Reach Level ${s.unlock.level}`;
    case "achievement":
      return ACHIEVEMENTS[s.unlock.id].description;
    case "premium":
      return "Premium · Buy or open crates";
    case "crate":
      return "Open crates to find this skin";
  }
}
