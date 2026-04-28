// Lightweight sound effect helper using expo-audio.
// Sounds are streamed from stable CDN URLs (Mixkit free SFX).
// Gracefully no-ops if loading fails (e.g. offline / unsupported on web).
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOUND_KEY = "@mmf_sound_enabled";

export type SfxName = "boost" | "ring" | "crash";

const URLS: Record<SfxName, string> = {
  boost:
    "https://assets.mixkit.co/active_storage/sfx/2566/2566-preview.mp3",
  ring:
    "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
  crash:
    "https://assets.mixkit.co/active_storage/sfx/3015/3015-preview.mp3",
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
  for (const k of Object.keys(URLS) as SfxName[]) {
    try {
      players[k] = createAudioPlayer({ uri: URLS[k] });
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
