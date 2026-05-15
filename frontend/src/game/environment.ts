// Sky environments switched by score. Each milestone unlocks a new look so
// long runs feel like flying into a new act. We just swap the gradient
// stops on the existing LinearGradient; cloud tint follows the same table
// so highlights match the palette.

export type Environment = {
  id: "dawn" | "day" | "sunset" | "night" | "storm";
  name: string;
  gradient: readonly [string, string, string];
  cloud: string;
  // Inclusive score threshold to enter this environment.
  scoreMin: number;
};

export const ENVIRONMENTS: readonly Environment[] = [
  {
    id: "dawn",
    name: "Dawn",
    gradient: ["#FFDEE9", "#FFE3B5", "#B5FFFC"],
    cloud: "#FFFFFF",
    scoreMin: 0,
  },
  {
    id: "day",
    name: "Day",
    gradient: ["#A5F3FC", "#BAE6FD", "#DBEAFE"],
    cloud: "#FFFFFF",
    scoreMin: 500,
  },
  {
    id: "sunset",
    name: "Sunset",
    gradient: ["#FBA5C5", "#FB923C", "#FBBF24"],
    cloud: "#FFEDD5",
    scoreMin: 1500,
  },
  {
    id: "night",
    name: "Night Sky",
    gradient: ["#1E1B4B", "#312E81", "#0F172A"],
    cloud: "#E0E7FF",
    scoreMin: 3000,
  },
  {
    id: "storm",
    name: "Storm",
    gradient: ["#475569", "#334155", "#0F172A"],
    cloud: "#94A3B8",
    scoreMin: 6000,
  },
];

export function environmentForScore(score: number): Environment {
  let env = ENVIRONMENTS[0];
  for (const e of ENVIRONMENTS) {
    if (score >= e.scoreMin) env = e;
  }
  return env;
}
