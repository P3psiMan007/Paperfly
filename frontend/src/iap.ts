// Unified purchase module for Paper Fly.
// - In a real EAS / native build: uses react-native-iap (StoreKit / Play Billing).
// - In Expo Go, web preview, or any env where the native module isn't linked:
//   falls back to Stripe Checkout via WebBrowser so the flow can still be exercised.
//
// IMPORTANT: react-native-iap MUST NOT be statically imported on web because
// Metro will try to bundle the native bridge and crash.  We use a guarded
// dynamic require() that only runs on iOS/Android *and* only inside a
// standalone/dev-client build (never inside Expo Go).

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import {
  createCheckoutSession,
  verifyIapReceipt,
  verifyIapConsumable,
} from "./api";
import type { SkinId } from "./skins";
import { KEY_PRODUCT_TO_COUNT } from "./crates";

export const PREMIUM_SKIN_IDS: SkinId[] = ["aurora", "phoenix", "galaxy"];

export const SKIN_TO_PRODUCT_ID: Record<string, string> = {
  aurora: "skin_aurora",
  phoenix: "skin_phoenix",
  galaxy: "skin_galaxy",
};

export const PRODUCT_ID_TO_SKIN: Record<string, SkinId> = Object.fromEntries(
  Object.entries(SKIN_TO_PRODUCT_ID).map(([k, v]) => [v, k as SkinId])
) as Record<string, SkinId>;

function isWeb(): boolean {
  return Platform.OS === "web";
}

function isStandaloneBuild(): boolean {
  if (isWeb()) return false;
  const env = (Constants as any).executionEnvironment;
  // Only standalone / dev-client have native modules.  Expo Go (storeClient) does NOT.
  return env === "standalone" || env === "bare";
}

let iapModuleCache: any | null = null;
let iapResolved = false;
function tryLoadIap(): any | null {
  if (iapResolved) return iapModuleCache;
  iapResolved = true;
  if (!isStandaloneBuild()) return null;
  try {
    // Guarded dynamic require; never executes on web because of isStandaloneBuild().
    iapModuleCache = require("react-native-iap");
  } catch {
    iapModuleCache = null;
  }
  return iapModuleCache;
}

let iapInitialized = false;
let purchaseUpdateSub: any = null;
let purchaseErrorSub: any = null;

export type PurchaseListenerCallbacks = {
  onSkinUnlock: (skinId: SkinId) => void;
  onKeysGranted: (count: number) => void;
};

export async function initPurchases(
  callbacks: PurchaseListenerCallbacks
): Promise<void> {
  const iap = tryLoadIap();
  if (!iap) return;
  if (iapInitialized) return;
  try {
    await iap.initConnection();
    iapInitialized = true;

    purchaseUpdateSub = iap.purchaseUpdatedListener(async (purchase: any) => {
      const productId: string =
        purchase.productId || purchase?.productIdentifier || "";
      const receipt: string =
        Platform.OS === "ios"
          ? purchase.transactionReceipt
          : purchase.purchaseToken;

      // Key pack (consumable)?
      const keyCount = KEY_PRODUCT_TO_COUNT[productId];
      if (keyCount && receipt) {
        try {
          const res = await verifyIapConsumable({
            platform: Platform.OS as "ios" | "android",
            product_id: productId,
            receipt,
          });
          if (res.granted) callbacks.onKeysGranted(res.granted);
          else callbacks.onKeysGranted(keyCount); // client fallback
        } catch {
          callbacks.onKeysGranted(keyCount);
        }
        try {
          // consumables MUST be finished with isConsumable=true so user can re-buy
          await iap.finishTransaction({ purchase, isConsumable: true });
        } catch {}
        return;
      }

      // Premium skin (non-consumable)?
      const skinId = PRODUCT_ID_TO_SKIN[productId];
      if (skinId && receipt) {
        try {
          await verifyIapReceipt({
            platform: Platform.OS as "ios" | "android",
            product_id: productId,
            receipt,
          });
        } catch (e) {
          console.warn("verify skin receipt failed", e);
        }
        callbacks.onSkinUnlock(skinId);
        try {
          await iap.finishTransaction({ purchase, isConsumable: false });
        } catch {}
        return;
      }
    });

    purchaseErrorSub = iap.purchaseErrorListener((err: any) => {
      console.warn("iap error", err);
    });
  } catch (e) {
    console.warn("initPurchases failed", e);
  }
}

export async function endPurchases(): Promise<void> {
  const iap = tryLoadIap();
  if (!iap || !iapInitialized) return;
  try {
    purchaseUpdateSub?.remove();
    purchaseErrorSub?.remove();
    await iap.endConnection();
  } catch {}
  iapInitialized = false;
}

export type PurchaseOutcome =
  | { kind: "iap_pending" }
  | { kind: "web_redirect"; sessionId: string; url: string }
  | { kind: "unsupported"; message: string }
  | { kind: "error"; message: string };

async function nativeRequestPurchase(
  productId: string
): Promise<PurchaseOutcome> {
  const iap = tryLoadIap();
  if (!iap) {
    return {
      kind: "unsupported",
      message:
        "In-app purchases need a real build. Run the app on a device via TestFlight / Play internal test.",
    };
  }
  try {
    if (!iapInitialized) {
      await iap.initConnection();
      iapInitialized = true;
    }
    await iap.requestPurchase({ sku: productId });
    return { kind: "iap_pending" };
  } catch (e: any) {
    return { kind: "error", message: e?.message || "Purchase failed" };
  }
}

export async function purchaseSkin(skinId: SkinId): Promise<PurchaseOutcome> {
  if (tryLoadIap()) {
    const productId = SKIN_TO_PRODUCT_ID[skinId];
    if (!productId) return { kind: "error", message: "Unknown skin" };
    return nativeRequestPurchase(productId);
  }
  // Expo Go / web fallback: Stripe checkout (dev only).
  try {
    const origin =
      (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") || "";
    const { url, session_id } = await createCheckoutSession(skinId, origin);
    await WebBrowser.openBrowserAsync(url);
    return { kind: "web_redirect", sessionId: session_id, url };
  } catch (e: any) {
    return { kind: "error", message: e?.message || "Checkout failed" };
  }
}

export async function purchaseKeys(productId: string): Promise<PurchaseOutcome> {
  if (tryLoadIap()) {
    return nativeRequestPurchase(productId);
  }
  return {
    kind: "unsupported",
    message:
      "Key packs use native in-app purchase. Run the app via TestFlight or Play internal testing to buy keys.",
  };
}

export function isNativePurchaseAvailable(): boolean {
  return tryLoadIap() !== null;
}
