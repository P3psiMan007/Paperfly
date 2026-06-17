# Paper Fly — Store Submission Guide

Production setup for shipping to **Apple App Store** and **Google Play Store**.

---

## 1. Project status

| Item | Status |
|------|--------|
| `app.json` configured (name, bundle ids, version, permissions) | ✅ |
| `eas.json` build + submit profiles | ✅ |
| Privacy policy (`PRIVACY.md`) | ✅ — host the rendered HTML at a public URL before submission |
| In-app purchase scaffolding (`react-native-iap`) | ✅ — products must still be created in App Store Connect / Play Console |
| Backend receipt verification endpoint (`POST /api/iap/verify`) | ✅ (basic — see notes) |
| Save / restore by code | ✅ |
| App icon + adaptive icon | ⚠️ placeholders in `assets/images/` — replace with your final icon |
| Sound effects | ✅ Mixkit CDN URLs |

---

## 2. Before you build

### 2.1 Edit `app.json`
- `expo.ios.bundleIdentifier` — currently `com.paperfly.app`. Change to your own reverse-DNS if you want.
- `expo.android.package` — must match the iOS bundle id pattern. Keep them identical for simplicity.
- `expo.version` — bump for every store release (e.g. `1.0.1`).
- `expo.ios.buildNumber` and `expo.android.versionCode` — increment for every build you upload (Apple/Google reject duplicates).
- `expo.extra.eas.projectId` — replace placeholder after running `eas init` (see § 3).

### 2.2 Replace placeholder assets
Drop final 1024×1024 PNGs into `frontend/assets/images/`:
- `icon.png` — main app icon
- `adaptive-icon.png` — Android foreground (transparent or solid background OK)
- `splash-icon.png` — splash logo (centered)
- `favicon.png` — web preview only

The pastel sky gradient `#FFDEE9 → #B5FFFC` works well; the yellow accent `#FDE047` is the brand color.

### 2.3 Host the privacy policy
1. Render `PRIVACY.md` to HTML (or paste into a GitHub Pages / Notion public page).
2. Replace the contact email in the file.
3. Paste the public URL into the App Store Connect "Privacy Policy URL" field and Google Play "Privacy Policy" field.

### 2.4 Create in-app products (premium skins)

You must create **3 non-consumable** products with these **exact product IDs**:

| Skin | Product ID | Suggested price |
|------|-----------|-----------------|
| Aurora | `skin_aurora` | $2.99 |
| Phoenix | `skin_phoenix` | $2.99 |
| Galaxy | `skin_galaxy` | $2.99 |

**App Store Connect**: My Apps → Paper Fly → Monetization → In-App Purchases → "+" → Non-Consumable.

**Google Play Console**: Monetize → Products → In-app products → "Create product" → Non-consumable.

Additionally, create **3 CONSUMABLE** products for the crate-key system:

| Key Pack | Product ID | Suggested price | Type |
|----------|-----------|-----------------|------|
| 1 Key    | `keys_1`  | $0.99           | Consumable |
| 6 Keys   | `keys_5`  | $3.99           | Consumable |
| 12 Keys  | `keys_10` | $6.99           | Consumable |

For both consoles you must also:
- Add tax/banking info before any product can go live.
- Submit each product for review (Apple) / activate it (Google).
- Add the localized title and description.

### 2.5 Bank / payout setup
- **Apple**: App Store Connect → Agreements, Tax, and Banking → fill out Paid Apps agreement, tax forms, and bank account.
- **Google**: Play Console → Payment settings → Merchant account.

Apple takes 30% (or 15% on the Small Business Program); Google takes 15% on the first $1M.

---

## 3. Build with EAS

```bash
# One-time
npm install -g eas-cli
cd /app/frontend
eas login          # use your Expo account (free)
eas init           # creates the EAS project; copy the projectId back into app.json > extra.eas.projectId
```

### 3.1 First development build (for testing IAP on a real device)
IAP only works on a real device or signed simulator build, NOT in Expo Go.

```bash
# iOS (requires Mac for local sim; or use EAS cloud build)
eas build --platform ios --profile development

# Android (.apk you can sideload)
eas build --platform android --profile development
```

Install the resulting build on a real iPhone (TestFlight internal testing) or Android device (Play Console internal testing track). When you tap a premium skin you'll see Apple's native purchase sheet using StoreKit's sandbox tester accounts.

### 3.2 Production builds

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

The output `.ipa` / `.aab` is what you upload to App Store Connect + Play Console (or use `eas submit` below).

---

## 4. Submit

After filling in `eas.json` with your Apple Team ID + ASC App ID and your Google service-account JSON:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Or upload manually:
- iOS: Transporter app or App Store Connect Web → Add Build.
- Android: Play Console → Production → Create new release → upload `.aab`.

---

## 5. Required store metadata

Both stores ask for:
- App name (max 30 chars iOS, 50 chars Android) — "Paper Fly"
- Subtitle / short description — "Tilt-to-fly arcade — collect rings, open crates, rule the skies"
- Long description (4000 chars) — write a clear feature list
- Category — Games → Casual / Arcade
- Age rating — 4+ (iOS) / Everyone (Android)
- Screenshots (5 minimum per device size) — use the Expo dev menu → "Take screenshot" or run on real devices
- Privacy policy URL (see § 2.3)
- Support URL (your website or a Notion page)
- Optional preview video (30s)

Apple-specific:
- **Privacy nutrition label** (App Store Connect → App Privacy): declare you collect a **Device ID** (linked to user, used for App Functionality only).
- **NSMotionUsageDescription** is already in `app.json`. Apple will show this when CoreMotion is first accessed.

Android-specific:
- **Data safety form** in Play Console: declare device ID + purchase history (linked to user, App Functionality).
- **Content rating questionnaire** (IARC) — answer "no violence, no ads" → Everyone rating.

---

## 6. Tip: avoid common rejections

- **Apple guideline 3.1.1** — premium skins MUST use StoreKit, NOT Stripe / web checkout. Our code falls back to Stripe only on web preview; on the actual App Store build, `react-native-iap` is used. ✅
- **Apple guideline 5.1.1** — must have a privacy policy URL.
- **Apple guideline 4.2** — apps that are "just" a website are rejected. We're a native game so we're fine.
- **Google policy** — must use Google Play Billing for digital goods in-app. ✅ (`react-native-iap` handles this.)

---

## 7. Test cards / sandbox accounts

- **iOS**: App Store Connect → Users and Access → Sandbox → create a test account (use a fresh email). Then on the device: Settings → App Store → Sandbox Account → sign in. Purchases will be free.
- **Android**: Play Console → Setup → License testing → add your Google account email. Then install the app from the **internal testing track** to see "Test card, always approves" at checkout.

---

## 8. Useful commands

```bash
cd /app/frontend

# Lint
yarn lint

# Type-check
yarn tsc --noEmit

# Run dev preview (Expo Go)
yarn start

# Build for store
eas build --platform all --profile production

# Submit to stores
eas submit --platform all --profile production

# Update OTA without rebuild (only for JS/asset changes)
eas update --branch production
```

---

## 9. Backend deployment

The FastAPI backend (`/app/backend`) must be deployed to a public HTTPS URL before the mobile app can hit it. The current preview URL is in `frontend/.env` as `EXPO_PUBLIC_BACKEND_URL` — replace with your production URL before building.

Endpoints used by the mobile app:
- `POST /api/save` / `GET /api/save/{code}` — cloud progress save/restore
- `POST /api/checkout/session` / `GET /api/checkout/status/{sid}` — Stripe (dev/web preview only)
- `POST /api/iap/verify` — Apple/Google receipt verification (production)
- `GET /api/owned-skins/{device_id}` — sync owned premium skins

Health check: `GET /api/` should return `{"ok": true}`.

---

## 10. Known TODO before public launch

- [ ] Replace placeholder `eas.projectId` with the one from `eas init`
- [ ] Replace placeholder icons in `assets/images/`
- [ ] Host PRIVACY.md publicly + put URL in stores
- [ ] Create the 3 in-app products in both consoles
- [ ] Add Apple Team ID + ASC App ID to `eas.json` if using `eas submit`
- [ ] Add Google service-account JSON for Play submission
- [ ] (Recommended) Implement full Apple/Google server-side receipt verification in `POST /api/iap/verify` — currently the endpoint records and trusts the client receipt. For production grade, call `verifyReceipt` on Apple's API and `androidpublisher.purchases.products.get` on Google's API.

Once those are done you can confidently click "Submit for Review" in both stores.

— Built with E1 on Emergent.
