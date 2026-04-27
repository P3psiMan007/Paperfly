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
