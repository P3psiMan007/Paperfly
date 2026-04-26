# Mr. Maybe Flight — Product Requirements Document

## Overview
A mobile flying game prototype built with Expo (React Native) where the player tilts their phone to steer a paper plane through an endless 2.5D sky filled with collectible rings and obstacles.

## Tech Stack
- **Framework**: Expo SDK 54, React Native 0.81, expo-router (file-based routing)
- **Sensors**: `expo-sensors` (Accelerometer + DeviceMotion fallback) for tilt/gyro
- **Storage**: `@react-native-async-storage/async-storage` (calibration, sensitivity, high score)
- **UI**: `expo-linear-gradient`, `@react-native-community/slider`, `@expo/vector-icons`
- **Haptics**: `expo-haptics` for ring collect / crash feedback
- **Backend**: FastAPI + MongoDB (template only — no game-specific endpoints required)

## Routes
| Path | Description |
| ---- | ----------- |
| `/` (`app/index.tsx`) | Start screen — title, best score, Start / Settings / Calibrate |
| `/game` (`app/game.tsx`) | Gameplay scene with HUD, overlays for ready/pause/game-over |
| `/settings` (`app/settings.tsx`) | Sensitivity slider, recalibrate, reset high score, instructions |

## Core Gameplay
- Plane auto-flies forward; player steers by tilting the phone.
- **Roll → horizontal movement**, **Pitch → vertical movement** (smoothed with low-pass filter).
- Calibration captures current pitch/roll as neutral; persisted in AsyncStorage.
- Sensitivity multiplier (0.3 – 2.5) applied to tilt; persisted.
- Endless spawning of rings (collect for +50) and pastel obstacles (collide → game over).
- Survival score increases over time, scaled by current speed.

## Controls
- **Tap & hold anywhere**: speed boost (yellow speed bar + speed lines + BOOST badge).
- **Swipe down**: brake (slow motion).
- **Pause** button (top-right) → resume / quit.
- **Calibration** with 3-second hold-steady countdown.

## HUD
- Score pill (top-left)
- Tilt indicator (center, small radar with yellow dot)
- Speed bar (top-right)
- Boost badge (bottom center, when active)

## Visual Style
- Pastel sky gradient (`#FFDEE9 → #B5FFFC`) with parallax cloud layers (3 depths).
- Neo-brutalist UI: 2px slate borders, hard shadow buttons, golden accent (`#FDE047`).
- 2.5D perspective: world objects projected via `screen = center + (worldPos × FOCAL/z)`; size scales with proximity. Collision activates when `z < 60` and projected distance overlaps.
- Paper plane rendered as layered triangle Views with subtle pitch/roll transforms.

## Persistence Keys
- `@mmf_calibration` – `{pitch, roll}`
- `@mmf_sensitivity` – number
- `@mmf_high_score` – number

## Performance
- Single `requestAnimationFrame` game loop (driven by refs, React state used only for HUD updates).
- Sensors poll at 16ms; tilt is low-pass filtered (0.18 smoothing factor).
- Object pruning when `z <= 5`.

## Smart Business Enhancement (Future)
- **Daily challenge seeds + ghost replays**: shareable scores boost virality and retention without backend changes (use deterministic seed-of-the-day for obstacle layouts).

## Test IDs
Start screen: `start-game-button`, `settings-button`, `calibrate-shortcut`, `high-score-card`
Game: `score-display`, `speed-indicator`, `tilt-indicator`, `boost-active`, `pause-button`, `ready-start-button`, `calibrate-button`, `restart-button`, `home-button`, `resume-button`, `quit-button`, `touch-capture`
Settings: `sensitivity-slider`, `recalibrate-button`, `reset-highscore`, `settings-back`
