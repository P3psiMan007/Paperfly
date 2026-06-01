# Best Practices for a Tilt-Controlled Arcade Game

A focused research brief on what makes a casual/arcade mobile game feel
**product-ready**: game feel ("juice"), reward psychology, button &
microinteraction design, HUD, onboarding, the game-over loop, sound, and
accessibility. Written for Paper Fly but applies to any score-chasing arcade game.

Sources are listed at the bottom and cited inline as `[n]`.

---

## 0. The one idea everything hangs on

> **Juice is communication, not decoration.** Every confirmed input, every
> successful action, every failed attempt needs a response the player can
> perceive — visually, audibly, and through touch. `[1][3]`

A game with weak feel isn't missing *features* — it's failing to *acknowledge the
player*. The player taps, something happens, but the game doesn't react with
enough weight, so the action feels hollow. The fix is almost never new mechanics;
it's layering feedback onto the mechanics you already have.

The rule of thumb from the juice literature: **build the mechanic so it works
silently first, then add feedback in three channels — sight, sound, touch — for
every meaningful event.** `[1][3][7]`

---

## 1. Game feel / "juice" — concrete techniques

These are the standard techniques, with the values practitioners actually use.

### 1.1 Screen shake
- Displace the camera **0.1–0.3 seconds** on significant impacts. `[1]`
- **Ease the shake out** (taper amplitude to zero) — a hard cut-off feels broken.
- **Map intensity to event weight** and stay consistent: a coin grab is a tiny
  nudge; a crash is a big jolt. If everything shakes the same, nothing reads.
- Mobile caveat: keep it subtle. Phone screens are small and held close; big shake
  reads as a bug. Cap amplitude lower than you would on console.

### 1.2 Hit-stop (a.k.a. freeze-frame)
- A **fraction-of-a-second pause** at the moment of major impact, borrowed from
  hand-drawn animation. The brief freeze lets the player register what happened
  and makes powerful actions feel earned. `[1]`
- Use it on the **crash** and on a **new-best moment**, not on routine coin grabs.
- Typical value: **30–80 ms**. Long enough to feel, short enough not to stutter.

### 1.3 Squash & stretch / scale pop
- On any "got it!" event, briefly **scale the element to ~1.1–1.15× then ease back
  to 1.0** over ~150–350 ms with an ease-out curve. `[1][3]`
- This is the single cheapest, highest-impact juice technique on a 2D game. Apply
  to: score numbers on milestone, collected coins, button presses, unlock cards.

### 1.4 Anticipation & follow-through
- Don't snap to an action — **wind up** slightly before, and **overshoot then
  settle** after (the classic 12-principles motion language). `[1]`
- For a score reveal: don't print the number — **count up** from 0 to final with an
  ease-out, slowing as it approaches. Anticipation is what makes a slot machine
  feel exciting; the same applies to a results screen.

### 1.5 Particles
- Dust on landings, sparks on impacts, **confetti on completions / new bests**. `[1]`
- Keep them dumb (position, lifetime, color — no physics) and pooled. On a coin
  grab, a 5–7 particle burst that radiates out and fades over ~250 ms reads as a
  tiny firework.
- **Scale particle count to event magnitude** — a normal grab is small, a combo
  tier-up or new-best is a shower.

### 1.6 Color flash & tweening
- Flash a brief full-screen tint on phase changes / big events, **fading 0.45 → 0
  over ~600 ms** with an ease-out. `[1]`
- Use `ease-in` (slow→fast) for things leaving, `ease-out` (fast→slow) for things
  arriving, `ease-in-out` for things that move and settle. **Linear easing is for
  passive ambient loops only** (a slow shimmer), never for reactions. `[3]`

### 1.7 Object recoil / knockback
- When two things collide, both should react — the plane should flinch, the
  obstacle should kick. Even a few pixels of displacement sells the impact. `[3]`

### 1.8 Order of operations
- **Add juice last.** Get the interface structurally stable, *then* layer shake,
  hit-stop, and particles. Juicing an unstable layout just hides bugs. `[1]`

---

## 2. Reward psychology — why "one more run" happens

Arcade/hyper-casual games run on a **compulsion loop**: action → reward →
anticipation of next reward. Each completed loop releases dopamine, which
reinforces the behaviour and pulls the player back in. `[4][5][6]`

### 2.1 Variable reward (the strongest lever)
- **Unpredictable rewards drive far more engagement than fixed ones.** Uncertainty
  about the *outcome* amplifies the craving — it's the same mechanism as a slot
  machine. `[4][5][6]`
- Practically: don't make every spawn identical and independent. Mix in occasional
  **windfall moments** (a cluster of coins, a lucky power-up) so the player
  sometimes gets an unexpectedly big payoff. The *possibility* of a big moment is
  what sustains attention.

### 2.2 Near-miss effect
- Narrowly avoiding failure triggers **almost the same reward response as a win**,
  which is why "so close!" makes players retry instead of quitting. `[4][6]`
- Reward threading between two close obstacles: a small score bonus + a "NEAR MISS"
  flash + a light haptic. It converts tension into a reward instead of just relief.

### 2.3 Loss aversion
- People work harder to **avoid losing** something than to gain the equivalent. `[6]`
- Surface what's at risk: show the current run's score on the pause/quit screen
  ("Quit? You'll lose 1,240 points."), frame a streak as a thing to protect, and
  nudge near the previous best ("80 points from your best!").

### 2.4 Instant gratification / zero friction
- Hyper-casual's core trick: **minimal onboarding, instant feedback, immediate
  reward.** Low effort → fast dopamine → repeat. `[4][5]`
- Time-to-fun should be **seconds**. Every loading screen, menu, or tutorial step
  between launch and play is a chance to lose the player. `[2][8]`

### 2.5 Clear goals + visible progress
- Each loop needs an obvious goal and **visible movement toward it.** `[5][6]`
- Locked rewards should be *visible and teased* with concrete progress ("320/500
  XP to this skin") — visible progress is far more motivating than a closed lock.
  This is the Zeigarnik effect: people are pulled to finish things they've started.

### 2.6 Daily return hooks
- Rewarding players **just for returning once per day** is nearly universal in the
  top 100 mobile games and is one of the highest-ROI retention investments. `[8]`
- A daily streak counter (with visible loss risk) leverages loss aversion to bring
  players back tomorrow.

> **Ethical note:** these same mechanisms power predatory F2P monetization `[4][6]`.
> For a premium/ad-free arcade game the goal is a *satisfying* loop, not a
> compulsive trap — use variable reward to make the game feel alive, not to extract.

---

## 3. Button & microinteraction design

A button is the moment of intent. On a touch game it owes the player four things:
**affordance, immediate feedback, correct timing, and the right size.** `[9][10][13]`

### 3.1 Size (hard rule)
- **iOS: 44×44 pt minimum. Android: 48×48 dp minimum.** `[9][13]`
- Add `hitSlop` padding around smaller controls so the *touch* target exceeds the
  *visual* target.

### 3.2 Press feedback (every button, every time)
- On press, the button must **visibly react**: a ripple, or a **scale to ~0.97**,
  or a **translateY down + shadow collapse** (skeuomorphic "push in"). `[9][10]`
- A plain opacity fade (the RN `activeOpacity` default) is the *weakest* possible
  signal — upgrade it.
- Give primary buttons an **offset drop-shadow** that collapses on press, so the
  button looks physically raised and then pushed in (works beautifully with a
  neo-brutalist border style).

### 3.3 Haptics — timing is everything
- **Fire the haptic at the exact instant of the visual/audio event** (button
  depression, animation peak). Even small delays feel unnatural. `[10][11][12]`
- **Match intensity to importance & frequency:** a light selection tick for routine
  taps; a stronger notification buzz for crossing a milestone or a crash. `[10][12]`
- **Don't over-haptic.** Frequent heavy haptics cause fatigue and drain battery —
  rate-limit notification-level haptics (e.g. max one per ~1.5 s). `[11][12]`
- Always provide a **haptics on/off setting** — and never rely on haptics alone;
  pair every buzz with a visual + sound so it degrades gracefully. `[11][12]`

### 3.4 Consistency
- Similar actions trigger **similar feedback** across the whole app. A "confirm"
  should always look, sound, and feel the same wherever it appears. `[10][12]`

### 3.5 Hierarchy
- **One primary CTA per screen.** Everything else is visually secondary. Two equally
  saturated "press me" buttons compete and slow the decision. `[7]`

### 3.6 Confirmation for destructive actions
- Irreversible actions (reset score, quit mid-run, delete save) need a **2-step
  confirm** — and frame the cost in loss-aversion terms.

---

## 4. HUD & readability under motion

- **Readability under motion:** HUD text must survive parallax/shake. Use a
  contrasting container (dark pill behind light text) and/or a **2 px outline or
  drop shadow.** Keep HUD anchored to screen edges and static during shake. `[1][14]`
- **Glanceable:** the player should read each element in **under ~300 ms**
  peripherally. Critical numbers ≥ 24 px; body ≥ 14–16 px at 1080p. `[14]`
- **Contextual visibility — hide what isn't needed now.** Show elements only when
  relevant (power-up timers only while active; a tilt indicator only early on, then
  fade it once the player has internalized the controls). A cluttered always-on HUD
  buries the critical info in noise. `[14]`
- **Notification queue:** cap to **2–3 visible at once**, newest pushes oldest out,
  critical bypasses the queue. Consolidate same-type events ("+50" "+30" → "+80").
  Timing: ~**200 ms slide-in, 3–5 s hold, 300 ms fade-out, ~500 ms gap** between
  items. `[14]`
- **Never encode meaning by color alone** (~8% of men have color-vision
  deficiency). Pair color with an icon, shape, or label. `[14]`

---

## 5. Onboarding / first-time experience (FTUE)

- **The first minutes decide whether a player stays or churns.** Onboarding must be
  simple, fast, and teach the core loop without overwhelming. `[8][2]`
- **Teach by doing, not by reading.** Minimize tutorial text; design the interface
  to feel instinctive so the tutorial can be short or invisible. `[2][5]`
- **Don't punish the first run.** A short grace period (no hazards for the first few
  seconds, with a gentle "tilt to steer →" prompt) lets the player learn the
  control before the pressure starts. Early, confusing deaths cause churn. `[8]`
- **Get to fun fast.** Load quickly, skip unskippable splash time, drop the player
  into action within seconds. `[2]`

---

## 6. The game-over loop — the most important screen

This screen decides whether the player taps retry or closes the app. Temple Run's
whole success is the "just one more try" feeling. `[8]`

What a product-ready game-over screen does:

1. **Animate the score reveal** — count up from 0 with an ease-out, a tick sound
   each step, a light haptic at intervals. Don't just print the number. `[1]`
2. **Tell the story of *change*, not just totals** — "+120 vs your best", "First
   time past 2,000", "Longest combo yet". Comparison against the player's own
   history is what drives the retry. `[6][8]`
3. **Celebrate unlocks and new bests loudly** — animated cards sliding in,
   confetti, a unique chime, a success haptic. The new-best moment should be the
   visual climax of the whole game. `[1][8]`
4. **Make retry the path of least resistance** — RETRY is the primary button; after
   ~2 seconds, add a subtle pulse to invite the instant re-tap. Removing friction
   from "play again" is the single biggest retention lever on this screen. `[8]`
5. **Surface what they just earned** — if a skin unlocked, offer a one-tap way to
   see/equip it rather than burying it in menus. `[8]`

---

## 7. Sound design

- **Every meaningful action gets a sound** — collection chimes, action whooshes,
  failure thuds, UI ticks. Silence on a tap reads as an unresponsive app. `[1][3]`
- **Pitch variation** prevents fatigue: nudge pitch up as a combo climbs, or
  randomize ±a few percent so repeated sounds don't grate. `[3]`
- **All feedback channels agree** — the sound, the visual, and the haptic fire
  together on the same frame for one coherent impact. `[10][12]`
- Keep assets tiny (a few kb each) and preload them so the first play isn't silent.

---

## 8. Accessibility (table stakes, not optional)

- **Respect "Reduce Motion."** Gate screen shake, big scale pops, flashes, and
  ambient drift behind the OS reduce-motion setting, with a calmer fallback. `[14]`
- **Don't rely on color alone** (see §4). `[14]`
- **Provide toggles:** sound on/off, haptics on/off, and ideally a UI-scale or
  larger-text respect.
- **Screen-reader labels** on every button (`accessibilityRole` + `accessibilityLabel`).
- **Honor minimum touch sizes** (§3.1) — this is an accessibility rule, not just a
  nicety. `[9][13]`
- **Always offer a fallback** for any haptic-only or motion-only cue. `[11][12]`

---

## 9. The product-ready checklist (TL;DR)

Feel
- [ ] Every action responds in sight + sound + touch
- [ ] Coin grab: particle burst + chime + light haptic + tiny score pop
- [ ] Crash: screen shake + hit-stop + heavy haptic + thud
- [ ] New best: confetti + score-color flash + success haptic + unique chime
- [ ] Easing on all reactions (never linear); count-up score reveal

Psychology
- [ ] Variable reward — occasional windfalls, not uniform spawns
- [ ] Near-miss bonus
- [ ] Loss-aversion framing on quit / near-best
- [ ] Visible progress toward the next unlock
- [ ] Daily return reward / streak

Buttons & UI
- [ ] 44/48 pt min touch targets
- [ ] Press-depth animation + haptic on every CTA
- [ ] One primary CTA per screen
- [ ] Confirm on destructive actions
- [ ] HUD readable under motion; hide what isn't needed now
- [ ] No color-only meaning

Flow
- [ ] Time-to-fun in seconds
- [ ] First-run grace period, teach by doing
- [ ] Game-over: animated reveal + change-vs-best + loud unlocks + frictionless retry

Accessibility
- [ ] Reduce-motion respected
- [ ] Sound + haptics toggles
- [ ] Screen-reader labels
- [ ] Fallbacks for every motion/haptic-only cue

---

## Sources

1. [Juice — Brad Woods' Digital Garden](https://garden.bradwoods.io/notes/design/juice)
2. [UX best practices for games — Android Developers](https://developer.android.com/topic/google-play-instant/best-practices/games)
3. [Game UI and UX Guide: Menus, HUDs, and Feedback — Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-guides/ui-and-ux-in-games-building-menus-huds-and-feedback-systems)
4. [Hyper-Casual Games: The Psychology of Why Simple Games Are So Addictive — Onia](https://onia.fun/blog/hyper-casual-games-the-psychology-of-why-simple-games-are-so-addictive/)
5. [What Makes Hyper-Casual Games So Addictive? — DEV Community](https://dev.to/krishanvijay/what-makes-hyper-casual-games-so-addictive-24me)
6. [Why Reward Loops tend to be so addictive in Mobile Games — GamingonPhone](https://gamingonphone.com/miscellaneous/why-reward-loops-tend-to-be-so-addictive-in-mobile-games)
7. [The Complete Game UX Guide for 2025 — Game-Ace](https://game-ace.com/blog/the-complete-game-ux-guide/)
8. [10 Simple Tips That Will Boost Your Player Retention — Felgo](https://blog.felgo.com/mobile-game-development/10-simple-tips-that-will-boost-your-player-retention)
9. [Top 10 Mobile Game UI Design Tips — Dotcom Infoway](https://www.dotcominfoway.com/blog/10-best-practices-on-mobile-game-ui-design-that-actual-gamers-love/)
10. [Best Practices for Mobile App Micro-Interactions — Zee Palm](https://www.zeepalm.com/blog/best-practices-for-mobile-app-micro-interactions)
11. [2025 Guide to Haptics: Enhancing Mobile UX — Saropa (Medium)](https://saropa-contacts.medium.com/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback-676dd5937774)
12. [Designing for Haptic Feedback — UX Pilot](https://uxpilot.ai/blogs/enhancing-haptic-feedback-user-interactions)
13. [Microinteractions in Mobile Apps: 2025 Best Practices — Rosalie (Medium)](https://rosalie24.medium.com/microinteractions-in-mobile-apps-2025-best-practices-c2e6ecd53569)
14. `game-ui-design` skill references (patterns.md, sharp_edges.md) — HUD, notification queue, readability-under-motion, color-blind, safe zones.

Additional grounding: Steve Swink, *Game Feel* (the standard text on this topic);
Jonasson & Purho, *Juice It or Lose It* (GDC 2012).
