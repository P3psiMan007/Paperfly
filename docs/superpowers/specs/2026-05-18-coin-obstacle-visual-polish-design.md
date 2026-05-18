# Coin + Obstacle Visual Polish — Design

**Date:** 2026-05-18
**Branch:** `claude/analyze-repo-XUaww`
**Scope:** Visual polish only. No new gameplay systems. No changes to tilt control, power-ups, combo, score multiplier, skins, projection math, or spawn pipeline. Two files modified.

## Why

Playtest feedback after the polish-and-juice pass:

- Coins read as a generic yellow disc at gameplay sizes. The existing SVG already has a radial gradient + star + highlight, but it's static (only a subtle inner pulse) and the star reads as a stock asset.
- Obstacles are pastel pink/red rounded squares with a thin dark border. All standard obstacles look identical. Drifters and splitters have behavior variety, but the *visual* read at spawn distance is monotone.

Goal: each coin should feel alive and worth grabbing; each obstacle should announce *something is dangerous and you should move*.

## Non-goals

- No new obstacle behaviors (no spinners, no homing, etc.). Just visual variants over the existing render path.
- No SVG outside `Coin.tsx`. New obstacle work stays on plain Views + transforms + Ionicons (font glyphs are fine — already used in HUD and power-ups).
- No changes to collision math, hit radius, projection, or `WorldObj` core fields.
- No Reanimated, no Skia.

## Coin redesign (`frontend/src/game/Coin.tsx` + call site in `frontend/app/game.tsx`)

### Changes

1. **Spin via `scaleX` oscillation.** The wrapper `View` at the call site gets `transform: [{ scaleX: spin }]` where `spin = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(performance.now() / 480 + o.id * 0.7))`. ~1.3 s period. Pre-frame compute, single sine. Per-object phase via `o.id * 0.7` so a screen full of coins doesn't pulse in unison.

2. **Chevron glyph replaces the star.** SVG `<Path>` swap: from the 5-point star to a bold up-pointing double chevron (`^^`). Reads as "score up" — more game-specific than a stock star.

3. **Travelling glint.** The existing white-ellipse highlight gets its `cx` driven by a slow sine so it sweeps across the face on a ~2 s cycle. Already a tiny element in the SVG — just parameterize its position.

### Why this works
- `scaleX` simulates a 3D flip cheaply (no perspective needed, no rotateY edge cases on RN).
- All compute is per-frame already (render runs every tick via `setTick`). No new state, no new refs.
- SVG is only modified inside the existing component — no new SVG anywhere else, no convention drift.

## Obstacle redesign (`frontend/app/game.tsx` + `frontend/src/game/projection.ts`)

### Changes

1. **New optional `variant: 0 | 1 | 2` on `WorldObj`.** Assigned at spawn (in the existing block where drift/split flags are rolled). Distribution:
   - `0` (~50%) — Chevron arrows (`>>>` pointing toward the screen).
   - `1` (~30%) — Warning icon (Ionicons `warning` glyph centered).
   - `2` (~20%) — Lozenge silhouette: same View, rotated 45°.

   Splitters and drifters can still carry a variant; the existing splitter treatment (hot orange + pulsing border + inner X) takes precedence and overrides the variant inner detail so the splitter signal stays unmissable.

2. **More saturated fill palette.** Replace the pastel `#FCA5A5` / `#FBA5C5` with `#DC2626` (red-600) and `#E11D48` (rose-600). Pastels say "soft", saturated reds say "dodge me".

3. **Bottom-edge weight stripe.** A 25%-tall absolutely-positioned dark View (`rgba(15,23,42,0.35)`) at the bottom of every standard obstacle, with the same border radius as the obstacle's bottom corners. Cheap fake AO; gives each box a sense of sitting in 3D rather than floating.

### Why this works
- Variants are silhouette + glyph diversity. A chevron-marked box, a warning-iconed box, and a rotated diamond all read as different *kinds of hazard* even when the fill color is the same.
- Saturated reds keep the warm palette but stop competing with the pastel sky.
- The weight stripe adds depth without breaking the flat-shape aesthetic; same trick the powerup tiles already use elsewhere via shadow.

### What stays
- Standard collision math (uses center distance to hit radius — independent of fill or inner detail).
- Drift behavior (`vx`) untouched.
- Splitter behavior + visual (hot orange + X + pulse) untouched.
- Dark `#0F172A` border + `borderRadius: size * 0.18` (consistent silhouette).

## Files touched

- `frontend/src/game/Coin.tsx` — SVG glyph swap + parameterized glint cx.
- `frontend/app/game.tsx` — coin call-site spin transform, obstacle render branch (variant glyphs + weight stripe + new fill palette), spawn block (variant roll).
- `frontend/src/game/projection.ts` — `variant?: 0 | 1 | 2` on `WorldObj`.

## Verification

- `yarn tsc --noEmit` passes after each commit.
- Manual on-device check via Expo Go:
  - A 60 s run should show clearly distinguishable obstacle silhouettes (chevron / warning / diamond) at spawn distance.
  - Coins should look like they're spinning, not just pulsing.
  - Splitter visual still pops over the new fill palette.

## Commit plan

Two commits, in order:
1. `feat(game): saturated obstacles with chevron / warning / lozenge variants`
2. `feat(coin): spinning illusion + chevron glyph + travelling glint`
