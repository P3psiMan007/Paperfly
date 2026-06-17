// Backend API client helpers for Paper Fly
import { getDeviceId } from "./device";
import type { Progress } from "./progression";

const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const BASE = RAW;
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
  const data = await jsonFetch<{ code: string }>(API("/save"), {
    method: "POST",
    body: JSON.stringify({ progress }),
  });
  return data.code;
}

export async function fetchSaveByCode(code: string): Promise<Progress> {
  const cleaned = code.toUpperCase().trim().replace(/\s+/g, "");
  const data = await jsonFetch<{ progress: Progress }>(
    API(`/save/${encodeURIComponent(cleaned)}`)
  );
  return data.progress;
}

export async function createCheckoutSession(
  skinId: string,
  originUrl: string
): Promise<{ url: string; session_id: string }> {
  const deviceId = await getDeviceId();
  return jsonFetch<{ url: string; session_id: string }>(
    API("/checkout/session"),
    {
      method: "POST",
      body: JSON.stringify({
        skin_id: skinId,
        device_id: deviceId,
        origin_url: originUrl,
      }),
    }
  );
}

export async function getCheckoutStatus(
  sessionId: string
): Promise<{
  status: string;
  payment_status: string;
  skin_id?: string | null;
  already_owned: boolean;
}> {
  return jsonFetch(API(`/checkout/status/${encodeURIComponent(sessionId)}`));
}

export async function getOwnedSkins(): Promise<string[]> {
  const deviceId = await getDeviceId();
  const data = await jsonFetch<{ owned: string[] }>(
    API(`/owned-skins/${encodeURIComponent(deviceId)}`)
  );
  return data.owned || [];
}

export async function verifyIapReceipt(body: {
  platform: "ios" | "android";
  product_id: string;
  receipt: string;
}): Promise<{ ok: boolean; skin_id?: string }> {
  const deviceId = await getDeviceId();
  return jsonFetch(API("/iap/verify"), {
    method: "POST",
    body: JSON.stringify({ ...body, device_id: deviceId }),
  });
}

export async function verifyIapConsumable(body: {
  platform: "ios" | "android";
  product_id: string;
  receipt: string;
}): Promise<{ ok: boolean; granted: number; product_id: string }> {
  const deviceId = await getDeviceId();
  return jsonFetch(API("/iap/verify-consumable"), {
    method: "POST",
    body: JSON.stringify({ ...body, device_id: deviceId }),
  });
}

// ── Daily Challenge Leaderboard ──────────────────────────────────────────
export type LeaderboardEntry = {
  name: string;
  score: number;
  rings: number;
  device_id: string;
  created_at: string;
};

export async function submitDailyScore(body: {
  name: string;
  score: number;
  rings: number;
  seed: string;
}): Promise<{ ok: boolean; rank: number; total: number }> {
  const deviceId = await getDeviceId();
  return jsonFetch(API("/leaderboard/daily"), {
    method: "POST",
    body: JSON.stringify({ ...body, device_id: deviceId }),
  });
}

export async function getDailyLeaderboard(
  seed: string
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  return jsonFetch(
    API(`/leaderboard/daily/${encodeURIComponent(seed)}`)
  );
}
