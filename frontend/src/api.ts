// Backend API client helpers
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
  ownedSkins: string[];
};

export async function fetchSaveByCode(code: string): Promise<RestoredSave> {
  const cleaned = code.toUpperCase().trim().replace(/\s+/g, "");
  const data = await jsonFetch<{
    progress: Progress;
    owned_skins?: string[];
  }>(API(`/save/${encodeURIComponent(cleaned)}`));
  return {
    progress: data.progress,
    ownedSkins: data.owned_skins || [],
  };
}

// Copy premium-skin ownership from the original device that created a save
// code onto the current device. Used by the "Restore Purchases" button on
// Skins so paid skins survive an app reinstall / phone switch.
export async function transferPurchasesByCode(code: string): Promise<string[]> {
  const cleaned = code.toUpperCase().trim().replace(/\s+/g, "");
  const deviceId = await getDeviceId();
  const data = await jsonFetch<{ owned: string[] }>(API("/transfer-device"), {
    method: "POST",
    body: JSON.stringify({ code: cleaned, new_device_id: deviceId }),
  });
  return data.owned || [];
}

export async function createCheckoutSession(
  skinId: string,
  originUrl: string
): Promise<{ url: string; session_id: string }> {
  const deviceId = await getDeviceId();
  return jsonFetch<{ url: string; session_id: string }>(API("/checkout/session"), {
    method: "POST",
    body: JSON.stringify({ skin_id: skinId, device_id: deviceId, origin_url: originUrl }),
  });
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
