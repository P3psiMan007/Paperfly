# Privacy Policy — Paper Fly

_Last updated: February 2026_

Paper Fly ("the app", "we") respects your privacy. This document explains what data the app collects and how it is used.

## TL;DR

- We do **not** collect any personal information.
- We do **not** track you across other apps or websites.
- We do **not** show ads.
- No analytics SDKs (Google Analytics, Facebook, etc.).
- Your gameplay progress is stored **on your device**. You can optionally generate an anonymous backup code (8 characters) to restore progress on another device.
- In-app purchases are processed by Apple App Store or Google Play; we never see your card details.

## What we store on your device

- Tilt calibration (pitch / roll offsets)
- Sensitivity preference
- XP, level, achievements, owned skins, equipped skin
- High score and last daily challenge score
- Sound on/off preference
- An anonymous device ID (random string) used to remember your premium-skin purchases

This data lives in your device's local storage (`AsyncStorage`). Deleting the app removes it.

## What we send to our server (optional)

If you choose to:

- **Generate a Save Code** — a copy of your local progress is uploaded to our server and assigned an 8-character code (e.g. `ABCD-1234`). Anyone with the code can read back the saved progress. Use this for cross-device transfer only. We never link the save to any personally identifying info.
- **Buy a premium skin** — we send Apple/Google's purchase receipt to our server for verification, then mark your anonymous device ID as the owner of that skin.

## Third parties

- **Apple App Store / Google Play** — handle all payments. Their own privacy policies apply.
- **Mixkit CDN** — serves the short sound effects on first load. Mixkit may log standard HTTP request data (IP, user agent).

## Data retention

- Local data: stays until you delete the app or clear progress.
- Cloud save codes: kept indefinitely so old codes still work. Email the developer at the address below to delete a specific code.
- Purchase records: kept indefinitely (legal/accounting).

## Children's privacy

The app is rated for general audiences and does not knowingly collect data from children under 13.

## Contact

For privacy questions or data deletion requests, email: **REPLACE_WITH_YOUR_EMAIL@example.com**

## Changes to this policy

We'll update the date at the top whenever this policy changes. Continued use of the app means you accept the updated policy.
