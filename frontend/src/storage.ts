import AsyncStorage from "@react-native-async-storage/async-storage";

export const KEYS = {
  CALIBRATION: "@mmf_calibration",
  SENSITIVITY: "@mmf_sensitivity",
  HIGH_SCORE: "@mmf_high_score",
};

export type Calibration = { pitch: number; roll: number };

export const loadCalibration = async (): Promise<Calibration> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CALIBRATION);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("loadCalibration failed", e);
  }
  return { pitch: 0, roll: 0 };
};

export const saveCalibration = async (c: Calibration) => {
  try {
    await AsyncStorage.setItem(KEYS.CALIBRATION, JSON.stringify(c));
  } catch (e) {
    console.warn("saveCalibration failed", e);
  }
};

export const loadSensitivity = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SENSITIVITY);
    if (raw) return Number(raw);
  } catch (e) {
    console.warn("loadSensitivity failed", e);
  }
  return 1.0;
};

export const saveSensitivity = async (v: number) => {
  try {
    await AsyncStorage.setItem(KEYS.SENSITIVITY, String(v));
  } catch (e) {
    console.warn("saveSensitivity failed", e);
  }
};

export const loadHighScore = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HIGH_SCORE);
    if (raw) return Number(raw);
  } catch (e) {
    console.warn("loadHighScore failed", e);
  }
  return 0;
};

export const saveHighScore = async (v: number) => {
  try {
    await AsyncStorage.setItem(KEYS.HIGH_SCORE, String(v));
  } catch (e) {
    console.warn("saveHighScore failed", e);
  }
};
