// Gold "coin" — used to be a thin ring of color. Now a filled disc with a
// radial-style highlight and outline, so it reads instantly as something
// you want to collect. Kept stateless so the game loop can render hundreds
// per frame without per-coin allocations.
import React, { memo } from "react";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Ellipse,
  Path,
} from "react-native-svg";

type Props = {
  size: number;
  // Slight pulse 0..1 fed by the game loop so coins gently breathe.
  pulse?: number;
  opacity?: number;
};

function CoinImpl({ size, pulse = 0, opacity = 1 }: Props) {
  const s = size;
  // Subtle 0..1 pulse drives only the inner highlight, not the outer disc,
  // so the coin doesn't visibly grow/shrink (kept it stable for hit-feel).
  const highlightOpacity = 0.55 + 0.25 * pulse;
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
      {/* Star glyph in the middle so it reads as a game coin, not a poker chip */}
      <Path
        d="M50 28 L56 44 L72 44 L59 54 L64 70 L50 60 L36 70 L41 54 L28 44 L44 44 Z"
        fill="#92400E"
        opacity={0.85}
      />
      {/* Bright top highlight (gives the metallic curvature illusion) */}
      <Ellipse
        cx="42"
        cy="34"
        rx="18"
        ry="8"
        fill="#FFFFFF"
        opacity={highlightOpacity}
      />
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
