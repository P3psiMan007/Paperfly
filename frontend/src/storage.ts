import AsyncStorage from "@react-native-async-storage/async-storage";

export const KEYS = {
  CALIBRATION: "@mmf_calibration",
  SENSITIVITY: "@mmf_sensitivity",
  HIGH_SCORE: "@mmf_high_score",
  SOUND_ENABLED: "@mmf_sound",
};

export type Calibration = { pitch: number; roll: number };

export const loadCalibration = async (): Promise<Calibration> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CALIBRATION);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pitch: 0, roll: 0 };
};

export const saveCalibration = async (c: Calibration) => {
  await AsyncStorage.setItem(KEYS.CALIBRATION, JSON.stringify(c));
};

export const loadSensitivity = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SENSITIVITY);
    if (raw) return Number(raw);
  } catch {}
  return 1.0;
};

export const saveSensitivity = async (v: number) => {
  await AsyncStorage.setItem(KEYS.SENSITIVITY, String(v));
};

export const loadHighScore = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HIGH_SCORE);
    if (raw) return Number(raw);
  } catch {}
  return 0;
};

export const saveHighScore = async (v: number) => {
  await AsyncStorage.setItem(KEYS.HIGH_SCORE, String(v));
};
