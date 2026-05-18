// Gold "coin" — filled disc with a radial-style face, outline, and a
// stroked double-chevron glyph in place of the old star. Two animated
// inputs now drive the metallic illusion:
//   - the caller scales the wrapping View on the X axis ("scaleX spin")
//     so the disc looks like it's flipping in 3D.
//   - `glint` (0..1) sweeps a bright highlight horizontally across the
//     face, clipped to the inner circle so it never spills past the rim.
// Both inputs are pure performance.now()-derived numbers at the call
// site — no per-coin state, no animation API.
import React, { memo } from "react";
import Svg, {
  ClipPath,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Ellipse,
  G,
  Path,
} from "react-native-svg";

type Props = {
  size: number;
  // Slight pulse 0..1 fed by the game loop so coins gently breathe; drives
  // the highlight's opacity (not size, so hit-feel stays stable).
  pulse?: number;
  // 0..1 phase of the travelling glint. The highlight ellipse's cx is
  // lerped between 22 and 78 inside the 100x100 viewBox, so the bright
  // spot sweeps across the face left-to-right as this rises.
  glint?: number;
  opacity?: number;
};

function CoinImpl({
  size,
  pulse = 0,
  glint = 0.5,
  opacity = 1,
}: Props) {
  const s = size;
  // Subtle 0..1 pulse drives only the inner highlight, not the outer disc,
  // so the coin doesn't visibly grow/shrink (kept it stable for hit-feel).
  const highlightOpacity = 0.55 + 0.25 * pulse;
  // Sweep the glint from 22 to 78 inside the 100-unit viewBox so it stays
  // visually contained by the face circle (r=40, centered at 50).
  const glintCx = 22 + glint * 56;
  return (
    <Svg width={s} height={s} viewBox="0 0 100 100" opacity={opacity}>
      <Defs>
        <RadialGradient id="coinFace" cx="50%" cy="42%" r="58%">
          <Stop offset="0%" stopColor="#FEF3C7" />
          <Stop offset="55%" stopColor="#FDE047" />
          <Stop offset="100%" stopColor="#D97706" />
        </RadialGradient>
        <LinearGradient id="coinRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FCD34D" />
          <Stop offset="1" stopColor="#92400E" />
        </LinearGradient>
        {/* Clip mask used to keep the travelling glint inside the inner
            face circle; without this the bright ellipse spills onto the
            rim when it's near the edges of its sweep. */}
        <ClipPath id="coinFaceClip">
          <Circle cx="50" cy="50" r="40" />
        </ClipPath>
      </Defs>

      {/* Outer rim ring */}
      <Circle cx="50" cy="50" r="46" fill="url(#coinRim)" />
      {/* Coin face */}
      <Circle
        cx="50"
        cy="50"
        r="40"
        fill="url(#coinFace)"
        stroke="#92400E"
        strokeWidth={1.5}
      />
      {/* Double chevron glyph — replaces the stock star. "Score up"
          read instead of "generic coin token". Drawn as a stroked path
          (two ^ shapes stacked) so the line weight scales cleanly. */}
      <Path
        d="M 30 50 L 50 32 L 70 50 M 30 66 L 50 48 L 70 66"
        stroke="#92400E"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.85}
      />
      {/* Travelling highlight, clipped to the face. Acts as both the
          metallic-curvature cue (always lit from above) and the
          spinning-coin cue (slides side to side under glint). */}
      <G clipPath="url(#coinFaceClip)">
        <Ellipse
          cx={glintCx}
          cy="34"
          rx="14"
          ry="7"
          fill="#FFFFFF"
          opacity={highlightOpacity}
        />
      </G>
      {/* Dark sliver at the bottom for depth */}
      <Ellipse
        cx="50"
        cy="80"
        rx="22"
        ry="5"
        fill="#78350F"
        opacity={0.25}
      />
    </Svg>
  );
}

export const Coin = memo(CoinImpl);
