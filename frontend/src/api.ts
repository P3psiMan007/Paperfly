// Backend API client helpers.
//
// The game ships with no in-app payments (Apple/Google forbid Stripe for
// digital goods; we'll integrate native IAP via RevenueCat post-launch).
// The backend's /checkout endpoints stay in place but are unused by the
// app. Cross-device save codes still go through /save + /save/{code}.
import { getDeviceId } from "./device";
import type { Progress } from "./progression";

const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const BASE = RAW; // The host already serves /api via the backend ingress
const API = (path: string) => `${BASE}/api${path}`;

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${txt || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function createSaveCode(progress: Progress): Promise<string> {
  const deviceId = await getDeviceId();
  const data = await jsonFetch<{ code: string }>(API("/save"), {
    method: "POST",
    body: JSON.stringify({ progress, device_id: deviceId }),
  });
  return data.code;
}

export type RestoredSave = {
  progress: Progress;
};

export async function fetchSaveByCode(code: string): Promise<RestoredSave> {
  const cleaned = code.toUpperCase().trim().replace(/\s+/g, "");
  const data = await jsonFetch<{ progress: Progress }>(
    API(`/save/${encodeURIComponent(cleaned)}`)
  );
  return { progress: data.progress };
}
