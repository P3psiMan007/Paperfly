// Lightweight sound effect helper using expo-audio.
// Sounds are bundled with the app (see assets/sounds/) so they always work
// offline and don't depend on a remote CDN staying up.
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOUND_KEY = "@mmf_sound_enabled";

export type SfxName = "boost" | "ring" | "crash";

// Module-level requires so Metro can statically bundle them.
const SOURCES: Record<SfxName, number> = {
  boost: require("../assets/sounds/boost.mp3"),
  ring: require("../assets/sounds/ring.mp3"),
  crash: require("../assets/sounds/crash.mp3"),
};

let players: Partial<Record<SfxName, AudioPlayer>> = {};
let loaded = false;
let enabled = true;

export async function loadSfxEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_KEY);
    if (raw !== null) enabled = raw === "1";
  } catch {}
  return enabled;
}

export async function setSfxEnabled(v: boolean): Promise<void> {
  enabled = v;
  try {
    await AsyncStorage.setItem(SOUND_KEY, v ? "1" : "0");
  } catch {}
}

export function isSfxEnabled(): boolean {
  return enabled;
}

export async function preloadSounds(): Promise<void> {
  if (loaded) return;
  loaded = true;
  for (const k of Object.keys(SOURCES) as SfxName[]) {
    try {
      players[k] = createAudioPlayer(SOURCES[k]);
    } catch (e) {
      // Ignore; play() will be a no-op if player missing
      console.warn("preload sfx failed", k, e);
    }
  }
}

export function playSfx(name: SfxName, volume = 0.6): void {
  if (!enabled) return;
  const p = players[name];
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {}
}

export function unloadSounds(): void {
  for (const k of Object.keys(players) as SfxName[]) {
    try {
      players[k]?.remove();
    } catch {}
  }
  players = {};
  loaded = false;
}
