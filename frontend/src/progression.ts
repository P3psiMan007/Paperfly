import AsyncStorage from "@react-native-async-storage/async-storage";
import { AchievementId, SkinId } from "./skins";

const KEY = "@mmf_progress_v1";

export type Progress = {
  xp: number;
  totalRings: number;
  totalBoosts: number;
  totalCrashes: number;
  longestRunSec: number;
  bestScore: number;
  achievements: AchievementId[];
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  lastDailySeed?: string;
  lastDailyScore?: number;
};

export const DEFAULT_PROGRESS: Progress = {
  xp: 0,
  totalRings: 0,
  totalBoosts: 0,
  totalCrashes: 0,
  longestRunSec: 0,
  bestScore: 0,
  achievements: [],
  ownedSkins: ["origami"],
  equippedSkin: "origami",
};

// XP thresholds (cumulative). Index = level - 1.
// Level 1 starts at 0 xp. To reach level N you need LEVELS[N-1] xp.
export const LEVELS = [
  0, 80, 200, 380, 620, 920, 1280, 1700, 2200, 2800, 3500, 4400, 5500, 7000,
  8800, 11000, 13500, 16500, 20000, 24000,
];

export function levelFromXp(xp: number): number {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) lv = i + 1;
  }
  return lv;
}

export function xpForLevel(level: number): number {
  return LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))];
}

export function nextLevelInfo(xp: number) {
  const cur = levelFromXp(xp);
  const curBase = xpForLevel(cur);
  const nextBase =
    cur >= LEVELS.length ? curBase + 2000 : xpForLevel(cur + 1);
  const span = nextBase - curBase || 1;
  const into = xp - curBase;
  return {
    level: cur,
    progress: Math.min(1, Math.max(0, into / span)),
    xpInto: into,
    xpNeeded: span,
    isMax: cur >= LEVELS.length,
  };
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Progress;
      // Forward-compat: ensure new fields exist
      return { ...DEFAULT_PROGRESS, ...parsed };
    }
  } catch (e) {
    console.warn("loadProgress failed", e);
  }
  return { ...DEFAULT_PROGRESS };
}

export async function saveProgress(p: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    console.warn("saveProgress failed", e);
  }
}

// Merge a restored save with current local progress without clobbering wins.
// Numeric stats take the max, arrays union, equipped skin prefers the restore.
export function mergeProgress(
  local: Progress,
  restored: Partial<Progress>
): Progress {
  const r: Progress = { ...DEFAULT_PROGRESS, ...restored };
  const unionArr = <T,>(a: readonly T[] = [], b: readonly T[] = []): T[] =>
    Array.from(new Set([...a, ...b]));
  const merged: Progress = {
    ...r,
    xp: Math.max(local.xp || 0, r.xp || 0),
    totalRings: Math.max(local.totalRings || 0, r.totalRings || 0),
    totalBoosts: Math.max(local.totalBoosts || 0, r.totalBoosts || 0),
    totalCrashes: Math.max(local.totalCrashes || 0, r.totalCrashes || 0),
    longestRunSec: Math.max(local.longestRunSec || 0, r.longestRunSec || 0),
    bestScore: Math.max(local.bestScore || 0, r.bestScore || 0),
    achievements: unionArr(local.achievements, r.achievements),
    ownedSkins: unionArr(local.ownedSkins, r.ownedSkins),
    equippedSkin: r.equippedSkin || local.equippedSkin,
  };
  // Daily best: keep the higher score for the matching seed, else newer seed.
  if (
    local.lastDailySeed &&
    r.lastDailySeed &&
    local.lastDailySeed === r.lastDailySeed
  ) {
    merged.lastDailySeed = local.lastDailySeed;
    merged.lastDailyScore = Math.max(
      local.lastDailyScore || 0,
      r.lastDailyScore || 0
    );
  } else if (
    local.lastDailySeed &&
    local.lastDailySeed > (r.lastDailySeed || "")
  ) {
    merged.lastDailySeed = local.lastDailySeed;
    merged.lastDailyScore = local.lastDailyScore;
  }
  return merged;
}

// Compute XP gained from a run (called once when run ends).
export function xpFromRun(score: number, rings: number, seconds: number): number {
  return Math.round(score * 0.4 + rings * 6 + seconds * 1.2);
}

export type RunStats = {
  score: number;
  rings: number;
  seconds: number;
  boosts: number;
  crashed: boolean;
  // Highest consecutive-coin streak this run (without missing / crashing).
  // Optional for backward-compat with any caller that hasn't been updated.
  bestCombo?: number;
};

export type RunResult = {
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
  unlockedSkinsByLevel: SkinId[];
  unlockedAchievements: AchievementId[];
  unlockedSkinsByAchievement: SkinId[];
  newBestScore: boolean;
};

// Apply a run to progress (mutates a copy and returns it + result).
export function applyRun(
  prev: Progress,
  stats: RunStats,
  // Provided to avoid circular import with skins.ts at runtime
  achievementIdsBySkin: Partial<Record<SkinId, AchievementId>>,
  skinsUnlockedByLevel: { id: SkinId; level: number }[]
): { next: Progress; result: RunResult } {
  const next: Progress = { ...prev };
  const xpGained = xpFromRun(stats.score, stats.rings, stats.seconds);
  next.xp = prev.xp + xpGained;
  next.totalRings = prev.totalRings + stats.rings;
  next.totalBoosts = prev.totalBoosts + stats.boosts;
  next.totalCrashes = prev.totalCrashes + (stats.crashed ? 1 : 0);
  next.longestRunSec = Math.max(prev.longestRunSec, stats.seconds);
  const newBestScore = stats.score > prev.bestScore;
  next.bestScore = Math.max(prev.bestScore, stats.score);

  // Achievements
  const unlockedAchievements: AchievementId[] = [];
  const newAch = (id: AchievementId, cond: boolean) => {
    if (cond && !next.achievements.includes(id)) {
      next.achievements = [...next.achievements, id];
      unlockedAchievements.push(id);
    }
  };
  newAch("rings_25", next.totalRings >= 25);
  newAch("survive_60", stats.seconds >= 60);
  newAch("boost_30", next.totalBoosts >= 30);
  newAch("score_500", stats.score >= 500);
  newAch("first_crash", stats.crashed);
  newAch("score_1500", stats.score >= 1500);
  newAch("survive_90", stats.seconds >= 90);
  newAch("rings_100", next.totalRings >= 100);
  newAch("combo_15", (stats.bestCombo || 0) >= 15);
  newAch("score_3000", stats.score >= 3000);

  // Skin unlocks via achievement
  const unlockedSkinsByAchievement: SkinId[] = [];
  for (const ach of unlockedAchievements) {
    const skinId = (Object.entries(achievementIdsBySkin).find(
      ([, a]) => a === ach
    ) || [])[0] as SkinId | undefined;
    if (skinId && !next.ownedSkins.includes(skinId)) {
      next.ownedSkins = [...next.ownedSkins, skinId];
      unlockedSkinsByAchievement.push(skinId);
    }
  }

  // Skin unlocks via level
  const prevLevel = levelFromXp(prev.xp);
  const newLevel = levelFromXp(next.xp);
  const leveledUp = newLevel > prevLevel;
  const unlockedSkinsByLevel: SkinId[] = [];
  if (leveledUp) {
    for (const { id, level } of skinsUnlockedByLevel) {
      if (
        level > prevLevel &&
        level <= newLevel &&
        !next.ownedSkins.includes(id)
      ) {
        next.ownedSkins = [...next.ownedSkins, id];
        unlockedSkinsByLevel.push(id);
      }
    }
  }

  return {
    next,
    result: {
      xpGained,
      leveledUp,
      newLevel,
      unlockedSkinsByLevel,
      unlockedAchievements,
      unlockedSkinsByAchievement,
      newBestScore,
    },
  };
}
