// Skins catalog for Mr. Maybe Flight.
// All skins are free — they're earned by XP levels or one-run achievements.
// The 'rare' tier just means a harder unlock; visually they have animated
// flair (shimmer / flame / galaxy) to feel like a real reward.

export type SkinId =
  | "origami"
  | "skyblue"
  | "sunset"
  | "mint"
  | "crimson"
  | "storm"
  | "ocean"
  | "aurora"
  | "neon"
  | "phoenix"
  | "stealth"
  | "galaxy";

export type SkinFlair = "plain" | "shimmer" | "flame" | "galaxy";

export type SkinPalette = {
  wingLight: string;
  wingDark: string;
  outline: string;
  tailFin: string;
  glow?: string;
  // For shimmer / animated skins
  gradient?: string[];
};

export type AchievementId =
  | "rings_25"
  | "survive_60"
  | "boost_30"
  | "score_500"
  | "first_crash"
  | "score_1500"
  | "survive_90"
  | "rings_100"
  | "combo_15"
  | "score_3000";

export type SkinUnlock =
  | { kind: "default" }
  | { kind: "level"; level: number }
  | { kind: "achievement"; id: AchievementId };

export type Skin = {
  id: SkinId;
  name: string;
  tagline: string;
  // 'rare' = the previously-premium skins. Same data shape as 'free' (they're
  // earnable), just rendered in a separate UI section so they feel special.
  tier: "free" | "rare";
  unlock: SkinUnlock;
  palette: SkinPalette;
  flair: SkinFlair;
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
  score_1500: {
    name: "Ace Pilot",
    description: "Reach 1,500 score in a single run",
  },
  survive_90: {
    name: "Marathon Flyer",
    description: "Survive 90 seconds in a single run",
  },
  rings_100: {
    name: "Coin Hoarder",
    description: "Collect 100 coins (lifetime)",
  },
  combo_15: {
    name: "On Fire",
    description: "Chain a 15-coin combo without missing",
  },
  score_3000: {
    name: "Legend",
    description: "Reach 3,000 score in a single run",
  },
};

export const SKINS: Record<SkinId, Skin> = {
  origami: {
    id: "origami",
    name: "Origami",
    tagline: "The classic paper plane",
    tier: "free",
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
    tier: "free",
    unlock: { kind: "level", level: 3 },
    flair: "plain",
    palette: {
      wingLight: "#DBEAFE",
      wingDark: "#60A5FA",
      outline: "#0F172A",
      tailFin: "#1E40AF",
    },
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    tagline: "Reach Level 5 · golden hour glow",
    tier: "free",
    unlock: { kind: "level", level: 5 },
    flair: "plain",
    palette: {
      wingLight: "#FED7AA",
      wingDark: "#FB923C",
      outline: "#7C2D12",
      tailFin: "#C2410C",
      glow: "#FDBA74",
    },
  },
  mint: {
    id: "mint",
    name: "Mint Glider",
    tagline: "Collect 25 rings (lifetime)",
    tier: "free",
    unlock: { kind: "achievement", id: "rings_25" },
    flair: "plain",
    palette: {
      wingLight: "#D1FAE5",
      wingDark: "#34D399",
      outline: "#0F172A",
      tailFin: "#047857",
    },
  },
  crimson: {
    id: "crimson",
    name: "Crimson Dart",
    tagline: "Reach Level 8",
    tier: "free",
    unlock: { kind: "level", level: 8 },
    flair: "plain",
    palette: {
      wingLight: "#FEE2E2",
      wingDark: "#F87171",
      outline: "#0F172A",
      tailFin: "#991B1B",
    },
  },
  storm: {
    id: "storm",
    name: "Storm",
    tagline: "Collect 100 coins lifetime · thunder gray",
    tier: "free",
    unlock: { kind: "achievement", id: "rings_100" },
    flair: "plain",
    palette: {
      wingLight: "#CBD5E1",
      wingDark: "#475569",
      outline: "#0F172A",
      tailFin: "#1E293B",
      glow: "#94A3B8",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    tagline: "Reach Level 10 · deep sea drift",
    tier: "free",
    unlock: { kind: "level", level: 10 },
    flair: "plain",
    palette: {
      wingLight: "#CFFAFE",
      wingDark: "#0891B2",
      outline: "#0F172A",
      tailFin: "#155E75",
      glow: "#22D3EE",
    },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    tagline: "Reach Level 12 · holographic shimmer",
    tier: "rare",
    unlock: { kind: "level", level: 12 },
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
  neon: {
    id: "neon",
    name: "Neon",
    tagline: "Chain a 15-coin combo · electric cyber glow",
    tier: "rare",
    unlock: { kind: "achievement", id: "combo_15" },
    flair: "shimmer",
    palette: {
      wingLight: "#F0ABFC",
      wingDark: "#22D3EE",
      outline: "#0F172A",
      tailFin: "#A21CAF",
      glow: "#22D3EE",
      gradient: ["#F0ABFC", "#22D3EE", "#FACC15", "#A21CAF"],
    },
  },
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    tagline: "Score 1,500 in one run · flame trail",
    tier: "rare",
    unlock: { kind: "achievement", id: "score_1500" },
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
  stealth: {
    id: "stealth",
    name: "Stealth",
    tagline: "Score 3,000 in one run · matte midnight",
    tier: "rare",
    unlock: { kind: "achievement", id: "score_3000" },
    flair: "plain",
    palette: {
      wingLight: "#1F2937",
      wingDark: "#0F172A",
      outline: "#FDE047",
      tailFin: "#FDE047",
      glow: "#FDE047",
    },
  },
  galaxy: {
    id: "galaxy",
    name: "Galaxy",
    tagline: "Survive 90 seconds · twinkling stars",
    tier: "rare",
    unlock: { kind: "achievement", id: "survive_90" },
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
  }
}
