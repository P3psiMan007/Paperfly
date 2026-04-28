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
