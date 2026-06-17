// Crate / key system for Paper Fly.
// Crates drop randomly from gameplay; keys are bought via IAP and used to open
// crates.  Each crate roll picks a rarity (weighted) and then a random skin of
// that rarity.  If the user already owns the rolled skin the result is
// converted to "dust" — an XP refund proportional to rarity.

import {
  SKIN_LIST,
  Skin,
  SkinId,
  SkinRarity,
  RARITY_DUST,
} from "./skins";

// Default weight per rarity (out of 100).  Tuned so mythic is genuinely rare.
export const RARITY_WEIGHTS: Record<SkinRarity, number> = {
  common: 55,
  rare: 25,
  epic: 12,
  legendary: 6,
  mythic: 2,
};

export type CrateRollResult =
  | { kind: "new_skin"; skin: Skin }
  | { kind: "duplicate"; skin: Skin; dustXp: number };

function pickRarity(rng: () => number): SkinRarity {
  const total =
    RARITY_WEIGHTS.common +
    RARITY_WEIGHTS.rare +
    RARITY_WEIGHTS.epic +
    RARITY_WEIGHTS.legendary +
    RARITY_WEIGHTS.mythic;
  let r = rng() * total;
  const order: SkinRarity[] = [
    "common",
    "rare",
    "epic",
    "legendary",
    "mythic",
  ];
  for (const tier of order) {
    r -= RARITY_WEIGHTS[tier];
    if (r <= 0) return tier;
  }
  return "common";
}

function skinsOfRarity(rarity: SkinRarity): Skin[] {
  return SKIN_LIST.filter((s) => s.rarity === rarity);
}

// Open a single crate.  `ownedSkins` controls duplicate detection.  Pass a
// custom `rng` (e.g., seeded) for tests; defaults to Math.random.
export function rollCrate(
  ownedSkins: SkinId[],
  rng: () => number = Math.random
): CrateRollResult {
  // Up to 3 attempts to find a non-empty rarity bucket
  let pool: Skin[] = [];
  let chosenRarity: SkinRarity = "common";
  for (let i = 0; i < 4; i++) {
    chosenRarity = pickRarity(rng);
    pool = skinsOfRarity(chosenRarity);
    if (pool.length > 0) break;
  }
  if (pool.length === 0) pool = skinsOfRarity("common");

  const skin = pool[Math.floor(rng() * pool.length)];
  const owned = ownedSkins.includes(skin.id);
  if (owned) {
    return {
      kind: "duplicate",
      skin,
      dustXp: RARITY_DUST[skin.rarity],
    };
  }
  return { kind: "new_skin", skin };
}

// How many crates does the player earn from a single run?
// Roughly: 1 crate per 250 score + a flat 7% bonus drop.
export function cratesEarnedForRun(score: number, rng: () => number = Math.random): number {
  const base = Math.floor(score / 250);
  const bonus = rng() < 0.07 ? 1 : 0;
  return base + bonus;
}

// IAP key pack definitions
export type KeyPackId = "keys_1" | "keys_5" | "keys_10";

export type KeyPack = {
  id: KeyPackId;
  productId: string; // Apple/Google product id
  keys: number; // total keys delivered (including bonus)
  priceLabel: string; // shown in UI before native sheet
  badge?: string;
};

export const KEY_PACKS: KeyPack[] = [
  {
    id: "keys_1",
    productId: "keys_1",
    keys: 1,
    priceLabel: "$0.99",
  },
  {
    id: "keys_5",
    productId: "keys_5",
    keys: 6,
    priceLabel: "$3.99",
    badge: "+1 BONUS",
  },
  {
    id: "keys_10",
    productId: "keys_10",
    keys: 12,
    priceLabel: "$6.99",
    badge: "BEST VALUE · +2",
  },
];

export const KEY_PRODUCT_TO_COUNT: Record<string, number> = {
  keys_1: 1,
  keys_5: 6,
  keys_10: 12,
};
