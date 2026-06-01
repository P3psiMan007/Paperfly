# Paper Fly — Polish Audit (Product-Readiness Pass)

**Date:** 2026-05-18
**Branch:** `claude/analyze-repo-XUaww`
**Author:** Claude session, grounded in `game-ui-design` patterns + mobile arcade
game psychology + Hoober thumb-zone research + Apple HIG / Material 3 mobile.

---

## 0. How to read this doc

Each finding has:
- **Severity** — P0 (blocks "feels product-ready"), P1 (clearly noticeable polish gap),
  P2 (nice-to-have).
- **Where** — file + line range.
- **Why it matters** — what the player feels.
- **Fix** — concrete change, code-shaped.

You don't have to ship all of these. Pick a tier and we'll cut a per-tier
implementation plan. Recommended cut-line is at the **end of P0 + 60 % of P1**
— that's the smallest set that visibly closes the gap.

---

## 1. Framework — what "product-ready arcade game" actually means

### 1.1 Game psychology (why the loop pulls)

| Lever | Description | Already in Paper Fly | Gap |
|-------|-------------|----------------------|-----|
| **Variable reward** | Unpredictable schedule of small wins (Skinner box). Each tick is uncertain. | Coins + power-up RNG + obstacle variants. | Coin / power-up *layouts* still feel uniform — every spawn is independent. No "windfall" moments. |
| **Near-miss** | Threading between hazards triggers same neural reward as a small win, so frustration becomes fuel. | None yet (Task 6 in NEXT_SESSION was a placeholder). | Missing entirely. Highest-ROI polish item. |
| **Tier celebration** | Crossing a threshold = HUD pop + sound + haptic. | Combo tier-up (commit `3ac800c`). | Only on combo. No tier-up on phase, distance, no-hit streak. |
| **Loss aversion** | Players play one more round to protect a streak / best. | `bestScore` shown. | Daily streak is silent. No "you're 80 pts from your best" nudge near the previous PB. No "almost" framing. |
| **Anticipation** | Buildup before a payoff (a slow-pull on a slot machine, a 3-2-1 countdown). | Phase transition flash (`62de55c`). | Game start is a "Fly" tap with no countdown beat. Ring magnet has no telegraphing pull-arc. |
| **Flow** | Difficulty curve matched to skill so the player stays in the productive-pressure zone. | `speedRef` ramp. | Curve is time-based, not skill-based. Crashing early doesn't make next run easier; surviving long doesn't pull future runs harder. No dynamic difficulty. |
| **Daily hook** | A FOMO mechanism that returns the player tomorrow. | Daily Challenge button. | No streak counter. No reminder. The button just shows yesterday's last score. |
| **Progression visibility** | Locked rewards visible, even teased; XP bar always available. | XP card on home; skin lock chips. | Locked skins are owned-or-not; no "you're 600 XP from this skin" callout on home. |

### 1.2 Mobile arcade button design

A button on a tilt-controlled phone game is doing more than just "be tappable" — it's
the moment of *intent*, the bridge between menu and motion. What it owes the player:

1. **Affordance** — looks pressable from a distance. Neo-brutalist border + offset
   shadow does this well. Already in your style — but only the border, not the
   offset shadow. Adds dimensionality.
2. **Press depth** — on touch, the button visibly *moves into the screen*. Two ways:
   `transform: scale(0.97)` (Material) or `transform: translateY(2px)` + shadow
   collapse (skeuomorphic). Your codebase uses `activeOpacity 0.85` only, which is
   a fade — much weaker signal.
3. **Haptic on press** — `Haptics.selectionAsync()` on `onPressIn` for every
   primary CTA. You do this for in-game events (coin grab, combo) but not for menu
   taps. The phone should respond to your thumb before the next screen even
   transitions.
4. **Hit area** — 44 × 44 pt on iOS, 48 × 48 dp on Android (HIG / Material). Your
   primary buttons hit ~52pt high (good), but the secondary row (`secondaryBtn` in
   `index.tsx`) is `paddingVertical: 12`, so probably ~40pt — borderline. Adding
   `hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}` is cheap.
5. **Disabled state** — visible (opacity 0.5 + no shadow). You do this implicitly via
   `disabled` prop on the cloud-restore button but no styling change. Players don't
   know why the button is dead.
6. **Loading state** — replace the icon with a spinner *inside the button*, keep the
   button's size identical, swap label to a progress-y verb. You partially do this
   ("Backing up…") but no spinner and no width lock — buttons shift.
7. **Primary / secondary hierarchy** — one and only one primary CTA per screen. On
   the main menu, "START GAME" and "DAILY CHALLENGE" are both saturated cyan/gold
   — competing. On Game Over, "RETRY" and "Share" and "Home" are presented as
   equal weight (one primaryBtn + two ghostBtn) which is correct.
8. **Press → release → confirm** — the heaviest CTAs (irreversibles like Reset High
   Score, Restore Progress) should require a held confirmation or a 2-step modal.
   You do an `Alert.alert` after restore, but not before. Reset High Score
   triggers immediately.

### 1.3 HUD design (in-game)

Borrowing from `game-ui-design/patterns.md`:

1. **Readability under motion** — text must survive camera shake / parallax. Your
   HUD passes this (anchored, white-on-pill, no jitter).
2. **Glanceability** — player must read each element in <300 ms peripherally. The
   score pill works. The speed bar reads as direction (left = brake) not magnitude,
   which is fine for arcade but a faint marker for "neutral" would help.
3. **Contextual visibility** — HUD elements should appear when relevant. PowerupHud
   already hides when no power-ups active (good). Combo wrap appears at combo ≥ 2
   (good). The TiltIndicator is *always* visible — could fade in only during
   calibration / settings, since experienced players don't need it.
4. **Notification queue** — `popupsRef` is your queue. Currently no priority
   handling: a tier-up popup + coin popup + phase banner can all stack on the same
   region. Phase banner now uses different y (~40%) so it doesn't collide, but
   tier-up + score popups both come from the plane area. A priority field would
   prevent visual clash.

### 1.4 Motion / animation language

The conventions doc forbids Reanimated. That's fine for performance — but it means
**every microinteraction has to ride the game-loop re-render trick or use
`Animated.Value` (you already mix both)**. The risk: animation cadence is
inconsistent. Some screens use Animated.timing (index bob), others use ref +
performance.now() reads (game.tsx HUD flash). Both work; pick one default for
each *type* of motion:

- **Continuous ambient motion** (cloud drift, plane bob, shimmer) → `Animated.loop`
  with `useNativeDriver: true` where possible.
- **Discrete one-shot reactions** (button press, popup) → ref + performance.now()
  read at render. Reuse the `scoreFlashUntilRef` pattern from `3ac800c`.

Easing audit:
- Bob (index): `Easing.inOut(Easing.sin)` — correct (organic).
- Shimmer (index): `Easing.linear` — fine for a passive loop.
- Phase fade (game): linear ramp 0→0.45 over 600ms — could use `easeOutQuad` for a
  punchier flash drop.

### 1.5 Sound + haptic timing

You have `playSfx("ring" | "boost" | "crash")` and Haptics on impacts. Gaps:

- **No selectionAsync on menu taps.** Every primary CTA tap should fire
  `Haptics.selectionAsync()` synchronously. Cost: ~5 lines.
- **No sound on UI events.** Menu taps are silent. A subtle tick on primary CTA
  press would close the loop. Use a single short asset (a "menu_tick" file).
- **Tier-up Haptic.Success** fires *after* the popup is queued, which means the
  haptic and the visual will be ~16ms offset. Imperceptible. Acceptable.
- **Crash haptic** is Heavy (correct) but the crash sound and the game-over
  overlay both arrive on the same frame — overlapping. Recommendation: delay the
  overlay by 250ms so the crash beat lands before the menu reads.
- **Slow-mo doesn't slow the soundtrack** (there's no soundtrack yet, so moot —
  but flag for later).
- **Phase Warning haptic** vs. **Tier-up Success haptic** — both fire often in late
  game. Risk of haptic fatigue. Suggest cooldown: max one notification haptic per
  1.5s globally.

### 1.6 Accessibility checklist

Game-readable doesn't mean accessible. Lift each box-tick to a checkbox in the
audit:

- [ ] **Color-only encoding**: Splitters rely on orange + yellow border. Color-blind
      users (deuteranopia) may read this as the standard obstacle. The X marker
      saves you — but it's small. Bump the marker line weight a touch.
- [ ] **Reduce motion setting**: No respect for `AccessibilityInfo.isReduceMotionEnabled()`.
      The HUD scale flash, combo tier-up scale, phase flash overlay, plane bob, and
      cloud drift should all soften when reduce-motion is on.
- [ ] **Dynamic Type / font scale**: All your `fontSize` values are absolute. Users
      with iOS "Larger Text" settings won't see scaled text. Wrapping critical
      strings in `allowFontScaling` (default true) is fine for body text but your
      tabular score is currently in a `Text` that *will* scale — verify the score
      doesn't reflow the pill.
- [ ] **Haptic-off setting**: Users who don't want haptics have no setting.
      Currently they can't disable.
- [ ] **No-sensor fallback**: Already done (the overlay at game.tsx ~L1546). Good.
- [ ] **Screen reader (VoiceOver / TalkBack)**: All `TouchableOpacity` should have
      `accessibilityRole="button"` and `accessibilityLabel`. Currently zero
      coverage. The game itself is tilt-controlled which is impossible for users
      who can't position their phone — that's a hard limit, but menus should at
      least be navigable.

### 1.7 First-time user experience (FTUE)

You have `TutorialOverlay` gated by `@mmf_tutorial_seen` (now should be
`@paperfly_tutorial_seen` — flagged below). Critical FTUE moments:

1. **App opens** → home screen. Player has 5 seconds to decide if this is worth
   playing. The title + plane bob are good. The "TILT TO FLY" eyebrow is good.
   "Hold screen to boost · Swipe down to brake" footnote is small (12px,
   opacity 0.55) — won't be read.
2. **Tutorial flow** — once. Acceptable.
3. **Calibration prompt** — currently buried as a button on the Ready overlay. New
   players will fly without calibrating, struggle, and quit. Either:
   - Force a one-time calibration on first run (the Ready overlay's tip text is
     too easy to skip),
   - Or default the calibration values to a "flat-ish-on-table" pose and let
     experienced players opt in.
4. **First run** — first death feels punishing because the player doesn't know
   the controls yet. Suggest a "First flight grace" mode for the first 3 runs:
   no obstacles for the first 5 seconds, gentle tutorial popup ("Tilt to steer →"
   then "Hold to boost").

---

## 2. Screen-by-screen audit

### 2.1 Main menu — `frontend/app/index.tsx`

Strong bones. Issues are mostly button feel + microcopy.

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.1.1 | **P0** | L185-193 `primaryBtn` | No press-depth animation, no haptic, no shadow. Feels like a 2018 button. | Wrap in `Pressable`, animate `transform: [{ scale: pressed ? 0.97 : 1 }]` + `translateY: pressed ? 1 : 0`, fire `Haptics.selectionAsync()` on `onPressIn`. Adds visible "shadow" offset View behind the button at `top: 4, left: 0, right: 0, bottom: -4, backgroundColor: '#0F172A', opacity: 0.95, zIndex: -1` so the button looks raised, then collapses on press. |
| 2.1.2 | **P0** | L195-210 `dailyBtn` | Same as 2.1.1 but worse — also competes with primary for "press me first". | Make Daily a secondary visual weight: smaller padding, no shadow, only saturated when the daily score chip is shown (i.e. you've played today). Or move to the secondary row. |
| 2.1.3 | **P1** | L242-244 footnote | "Hold screen to boost · Swipe down to brake" is fontSize 12, opacity 0.55, centered. Players miss this. | Replace with an icon row: ⬇ Brake · ⏺ Boost · 🎯 Aim, large enough to actually read (16px, opacity 1, separator dots). |
| 2.1.4 | **P1** | L138-141 levelBadge | LVL N badge is good but doesn't link to anything. Tapping does nothing. | Make it a `Pressable` that routes to `/skins` (since skins unlock by level). Tooltip via `Alert.alert` is fine if no better target. |
| 2.1.5 | **P1** | L213-238 secondaryBtn row | Three icons with text labels. Calib. label is truncated ("Calib." not "Calibrate") — feels lazy. | Either widen the buttons (drop to 2 rows of 2) or use icon-only buttons with a tap-and-hold tooltip for label. |
| 2.1.6 | **P2** | L119-127 cloud decorations | Static. The actual game has parallax clouds — preview that feel here. | Wrap in `Animated.View` with a slow horizontal `translateX` loop. |
| 2.1.7 | **P2** | L142-163 planeBox | Plane bobs but doesn't react to the user's actual phone tilt. | Subscribe to DeviceMotion *briefly* (sample at 5Hz) and apply small tilt to the plane preview. Makes the home screen feel alive on day one. |
| 2.1.8 | **P0** | TUTORIAL_KEY = "@mmf_tutorial_seen" L28 | Stale key — references old name. Existing users' tutorial state is preserved but new key for new name confuses on migration. | Either keep the old key (compat) or write a one-shot migration: `getItem("@mmf_tutorial_seen") → setItem("@paperfly_tutorial_seen", ...)`. |

### 2.2 Ready / Calibration overlays — `frontend/app/game.tsx` ~L1580

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.2.1 | **P0** | L1580-1635 Ready overlay | "Ready?" title is the only word that hits hard. Player can't see their plane or what they're about to fly. | Show the plane *behind* the overlay (transparent BG card), so the player has visual continuity into the game. Also: countdown `3 → 2 → 1 → GO!` after Fly tap, not instant. |
| 2.2.2 | **P0** | L1610-1626 button row | "FLY" and "Calibrate" are equal visual weight, primary + ghost. Calibrate is dangerous to skip on first run. | First-run-only: show a banner ("Tap Calibrate first ↓") and gray out FLY until either tapped or skipped explicitly. Repeat-run: current layout is fine. |
| 2.2.3 | **P1** | L1638-1650 calibrationOverlay | "HOLD STEADY" text + countdown is good, but no haptic at countdown ticks. | `Haptics.selectionAsync()` on each second tick. Final "Calibration set" `Haptics.notificationAsync(Success)`. |
| 2.2.4 | **P1** | L1628-1634 back link | "← Back to menu" is text-only, easy to miss. | Replace with the same back button style used on Settings (`backBtn` style). |

### 2.3 Pause overlay — `frontend/app/game.tsx` ~L1653

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.3.1 | **P1** | L1655 overlayTitle | "Paused" is the only content. Player loses context. | Show current run snapshot: score, coins, time alive. Encourages "let me grab one more before quitting". |
| 2.3.2 | **P0** | L1669-1676 quit button | Quitting mid-run abandons score with zero confirmation. Loss-aversion fail. | Confirmation modal: "Quit run? You'll lose 1,240 points." Use a `confirm`-style 2-step. |
| 2.3.3 | **P1** | no | Resume on tap is a single Fly button. No countdown on resume → instant action with stale tilt calibration. | Add 1-2 second "3-2-1 Resume" countdown so the player can re-grip. |

### 2.4 Game-over overlay — `frontend/app/game.tsx` ~L1681

This is the most psychologically important screen. Currently it's a stats card +
3 buttons, which is competent but undramatic.

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.4.1 | **P0** | L1681 onwards | No score-reveal animation. Final score is just rendered. | Animate the SCORE statValue counting up from 0 → final over 1.2s with ease-out. Sound tick at each 100. Fire `Haptics.impactAsync(Light)` at every 250. |
| 2.4.2 | **P0** | L1693-1710 statsRow | Stats are presented flat. The interesting story is *change vs. previous best* — that's what brings the player back. | Add diff chips: "+120 vs your best", "First time past 2,000", "Longest combo: ×4 (new!)". |
| 2.4.3 | **P0** | L1712-1753 rewardBlock | Critical reveals (Level Up, Skin Unlocked) appear as plain Text. No celebration. | Make each unlock an animated card that slides in from below, scales up, fires `Haptics.notificationAsync(Success)`, plays a unique chime. Stagger reveals by 600ms. |
| 2.4.4 | **P0** | L1748-1751 New Best Score! | Renders as red text. Should be the visual climax. | Confetti / particle burst across the overlay (you already have particle infra from `fc92af3`). Override the SCORE statValue color to yellow (the brand accent) with the same scale-flash treatment as the in-game HUD. |
| 2.4.5 | **P1** | L1755-1780 button row | RETRY is primary (correct). Share is ghost (correct). Home is also ghost (correct). | Add a fourth button row: "View Skins" if a skin was unlocked this run — preview the new skin equipped on the home screen. Currently the player has to dig through menus to find what they just earned. |
| 2.4.6 | **P1** | L1683-1690 dailyTag | Daily Challenge result needs a leaderboard hook even if leaderboard isn't built. | "12,400 — Today's score. Yesterday: 9,800." Daily delta is intrinsic comparison. |
| 2.4.7 | **P0** | n/a | No "1 more run?" pattern. Player closes the app after each death. | Mid-game-over (after 2 seconds), show a subtle "Tap to retry instantly" pulse on the RETRY button. Repeat-call-to-action lifts retention >20% in arcade games. |

### 2.5 Settings — `frontend/app/settings.tsx`

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.5.1 | **P0** | L283-290 Reset High Score | No confirmation. Tap → score gone forever. | `Alert.alert("Reset high score?", "This is permanent.", [{text: "Keep"}, {text: "Reset", style: "destructive", onPress: ...}])` |
| 2.5.2 | **P1** | L130-141 Sensitivity slider | No haptic feedback as slider moves. Numbers update silently. | `Haptics.selectionAsync()` debounced 100ms on `onValueChange`. |
| 2.5.3 | **P1** | L172-194 CALIBRATION step list | Numbered text steps. Long. Players skim. | Replace with 3 illustrated icons in a row: 🧘 sit · 👆 tap · ⏱ hold. Same info, 80% smaller. |
| 2.5.4 | **P2** | L150-163 sound toggle | Binary on/off. | Add a "music" toggle (currently no music) and a "haptics" toggle. |
| 2.5.5 | **P2** | L207-278 cloud save card | Lots of explanatory text. Generates a code, shows it, share button. | Add QR-code rendering (`react-native-qrcode-svg` is small) so users can scan their save onto a second device. Materially nicer than typing ABCD-1234. |
| 2.5.6 | **P1** | L293-301 "HOW TO PLAY" | Text-only with bullets. | Reuse the TutorialOverlay component as an inline help section, or link to "Replay tutorial" button. |

### 2.6 Skins — `frontend/app/skins.tsx`

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.6.1 | **P0** | L218-224 lockChip | "Reach LVL 5" is text-only. No XP progress to that skin specifically. | Show a tiny progress bar per locked skin ("LVL 5 · 320/500 XP"). Loss aversion: visible progress is more motivating than a closed lock. |
| 2.6.2 | **P0** | L188-235 SkinCard | TouchableOpacity with no spring-in animation when equipping. | On equip: scale the card 1.1 for 200ms, fire `Haptics.notificationAsync(Success)`, briefly tint the page background that skin's accent color. |
| 2.6.3 | **P1** | L283-290 sectionLabel | "EARN BY PLAYING" / "RARE · CHALLENGE UNLOCKS" — labels at the same visual weight. | Make rare section header bigger / colored to telegraph aspiration. |
| 2.6.4 | **P1** | L204-213 preview | Static plane in the card. No motion. | Add slow bob/shimmer to the card preview (reuse the same Animated.loop). Owned skins should *animate*; locked skins stay static (more "asleep"). |
| 2.6.5 | **P2** | L226-228 equippedChip | "EQUIPPED" pill is dark/small. Could be more celebratory. | Subtle confetti or sparkle behind the EQUIPPED state. |
| 2.6.6 | **P2** | L139-160 achievement list | Plain rows. No "next achievement" teaser. | Add 1-2 grayed-out "next achievement to unlock" rows under the user's list. |

### 2.7 Tutorial — `frontend/src/Tutorial.tsx` (not read in full but referenced)

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.7.1 | **P1** | n/a | Tutorial is presented as a one-time overlay. Players who skip it lose all context. | Add "Replay tutorial" button in Settings (called out in 2.5.6). |
| 2.7.2 | **P1** | n/a | No interactive tutorial — only screens. | Optional: a "try it" tilt-arrow on-screen with no obstacles for 5 seconds during first run. |

### 2.8 Game world / in-game visuals

Already polished significantly in this branch (commits `bb1c1da` through
`cc8e558`). Remaining gaps:

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 2.8.1 | **P1** | game.tsx (PaperPlane render) | Plane sprite is the same regardless of tilt — no roll banking visualization. | Apply a roll transform to the PaperPlane proportional to `smoothTiltRef.current.roll`. Gives the player a real motion proprioception cue. |
| 2.8.2 | **P1** | game.tsx particles | Particles are all yellow (coin color). On a near-miss (when added), they should be a different hue. | Pass `color` into the particle spawn function per call. |
| 2.8.3 | **P2** | game.tsx phase transitions | Phase flash is white. Could be the *next phase's* hero color (sunset → orange, night → indigo). Reinforces the transition meaning. | Read `nextEnv.gradient[0]` for the flash color instead of hard-coded white. |
| 2.8.4 | **P1** | game.tsx HUD | No "game time" or "distance" counter. Score is the only number — no "I survived 47 seconds" stat. | Add a small distance/time chip in the HUD (low-priority visual). Useful at game-over for "personal best survival time". |
| 2.8.5 | **P0** | TiltIndicator | Always visible during play. Adds visual noise once a player has internalized the controls. | Auto-hide TiltIndicator after the first 30 seconds of the player's career (track in AsyncStorage). Or hide unless tilt magnitude > deadzone. |

### 2.9 Cross-cutting: brand + visual system

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 2.9.1 | **P0** | The brand has no consistent type stack. All `Text` uses RN default sans-serif. | Add 2 fonts via expo-font: a display font (e.g. Outfit / Bebas Neue / Space Grotesk) for titles + a UI sans (Inter / SF) for body. Defined in `_layout.tsx`. |
| 2.9.2 | **P0** | Color palette is split across many files. Hard to maintain. | Extract `frontend/src/theme.ts` exporting `COLORS`, `RADII`, `SPACING`, `SHADOW`. Import everywhere. Aligns with `design_guidelines.json`. |
| 2.9.3 | **P1** | No icon for app — currently using `assets/images/icon.png` (likely the Expo default). | Commission/generate a brand icon: yellow paper plane on cyan-pink gradient, neo-brutalist outline. Update `app.json`. |
| 2.9.4 | **P1** | App splash screen is also Expo default. | Replace `splash-icon.png` with a Paper Fly hero (centered plane + title). |
| 2.9.5 | **P2** | No share image / OG image for web preview. | Generate a 1200×630 share card. |
| 2.9.6 | **P1** | Sound assets are minimal (boost/ring/crash only per the loaded `preloadSounds()`). | Add at least: menu_tick, level_up, unlock, daily_complete, phase_change, near_miss. Each <10kb mp3. |
| 2.9.7 | **P1** | No background music / ambient pad. | Optional low-volume ambient pad with a "music" toggle (per 2.5.4). Quiet enough to not fight SFX. |

---

## 3. Prioritized findings — flat list

### P0 (ship-blockers for "feels product-ready")

1. **2.1.1 / 2.1.2** — Press-depth animation + haptic on primary CTAs on home screen.
2. **2.1.8** — Migrate `@mmf_tutorial_seen` AsyncStorage key.
3. **2.2.1** — Show plane behind Ready overlay + countdown into the run.
4. **2.2.2** — First-run Calibrate gating.
5. **2.3.2** — Mid-run quit confirmation.
6. **2.4.1 / 2.4.2 / 2.4.3 / 2.4.4** — Game-over animation: count-up score, diff
   chips, animated unlock reveals, new-best confetti.
7. **2.4.7** — Instant-retry pulse 2 seconds after game over.
8. **2.5.1** — Reset High Score confirmation.
9. **2.6.1** — Per-skin XP progress on lock chip.
10. **2.6.2** — Equip animation + haptic + accent flash.
11. **2.8.5** — Auto-hide TiltIndicator after first 30s lifetime.
12. **2.9.1** — Custom fonts.
13. **2.9.2** — Theme module.

### P1 (clearly noticeable polish gap)

14. **2.1.3** — Replace footnote with iconography row.
15. **2.1.4** — LVL badge tappable.
16. **2.1.5** — Secondary row legibility (drop "Calib." truncation).
17. **2.2.3 / 2.2.4** — Calibration haptic ticks + back button styling.
18. **2.3.1 / 2.3.3** — Pause shows run stats + resume countdown.
19. **2.4.5 / 2.4.6** — View-skins shortcut + daily delta.
20. **2.5.2 / 2.5.3** — Sensitivity haptic + icon-row calibration steps.
21. **2.5.6** — Tutorial replay shortcut.
22. **2.6.3 / 2.6.4** — Rare section weight + skin card animation.
23. **2.7.1 / 2.7.2** — Replay tutorial + interactive first-run grace.
24. **2.8.1 / 2.8.2 / 2.8.4** — Plane banking + particle color + survival chip.
25. **2.9.3 / 2.9.4 / 2.9.6** — Brand icon, splash, sound assets.
26. **2.9.7** — Ambient music toggle.

### P2 (nice-to-have)

27. **2.1.6 / 2.1.7** — Animated home clouds + tilt-reactive plane preview.
28. **2.5.4 / 2.5.5** — Music + haptics toggles, QR code for save.
29. **2.6.5 / 2.6.6** — Equipped-state sparkle + next-achievement teaser.
30. **2.8.3** — Phase flash uses next env's hero color.
31. **2.9.5** — OG / share image.

---

## 4. Cross-cutting accessibility punch list

Add these as a single "accessibility pass" commit:

- [ ] `AccessibilityInfo.isReduceMotionEnabled()` listener at app root. Gate
      cloud drift, plane bob, shimmer, HUD scale flash, phase flash, particle burst
      behind it. Provide a static fallback for each.
- [ ] `accessibilityRole="button"` + `accessibilityLabel` on every `TouchableOpacity`
      and `Pressable`. Estimate: 18 callsites.
- [ ] `accessibilityLiveRegion="polite"` on score, combo, powerup HUD so screen
      readers announce changes.
- [ ] Haptics global on/off in Settings (per 2.5.4).
- [ ] Color-blind sanity: confirm splitter X marker is wide enough (currently
      `size * 0.6` length, `0.06 * size` thickness — bump thickness floor to 3px).
- [ ] Verify all `fontSize` < 12 are either tabular numerals (acceptable) or
      bumped to 12+.

---

## 5. Recommended implementation order

Ship in this sequence — each ships independently, each is testable on phone:

1. **Brand foundation** (2.9.1 + 2.9.2) — Fonts + theme module. Everything
   downstream uses these tokens.
2. **Button system** (2.1.1 + 2.1.2 + 2.5.1 + 2.6.2) — One `<GameButton>`
   component handles press depth, shadow, haptic, disabled, loading. Replace
   all `TouchableOpacity` callsites in one PR.
3. **Game-over redesign** (2.4.1 → 2.4.7) — Biggest psychological lift, single
   screen, contained scope.
4. **Ready / countdown / first-run gating** (2.2.1 / 2.2.2 / 2.7.2).
5. **Skin polish** (2.6.1 / 2.6.2 / 2.6.4).
6. **HUD auto-hide + plane banking** (2.8.1 / 2.8.5).
7. **Accessibility pass** (Section 4, as one commit).
8. **P1 sweep** in remaining file-locality order.
9. **Assets pass** (2.9.3 / 2.9.4 / 2.9.6) — needs design work, can run in
   parallel with code.
10. **P2 backlog** as time allows.

A realistic estimate: P0 = 2-3 focused days of coding. P0 + 60% of P1 = ~5 days.
Adding the assets pass (icon, splash, sound) probably adds another half-day if
you have someone available to make them or use a generator.

---

## 6. Out of scope (deliberately not addressed)

- Leaderboards / online play (architectural change, server work).
- Monetization (ads, IAP) — flagged for a separate PRD discussion.
- New gameplay systems (per `NEXT_SESSION.json` non_goals).
- Backend rename hardening (slug change implications) — see commit `3af7edb`.

---

## 7. References consulted

- `game-ui-design` skill — patterns + sharp_edges + validations.
- Apple Human Interface Guidelines — Touch Targets, Modality, Feedback.
- Material 3 — Buttons, Motion, Haptics.
- Steven Hoober, *How Do Users Really Hold Mobile Devices?* — thumb zone.
- Steve Swink, *Game Feel* — moment-to-moment polish framework.
- Martin Jonasson + Petri Purho, *Juice it or lose it* (GDC 2012) — juice
  principles.
- Apple iOS HIG, *Designing for Games* — pause flow, life systems.
- Nielsen Norman Group, *Mobile Game UX* — fatigue, retention, FTUE.
- `NEXT_SESSION.json` — current branch constraints + non_goals.
