import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@mmf_device_id";

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {}
  const id = `mmf-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {}
  cached = id;
  return id;
}
