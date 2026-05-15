import React, { memo } from "react";
import { View } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";
import { Skin, SKINS, SkinId } from "./skins";

type Props = {
  size?: number;
  tilt?: number;
  pitch?: number;
  skinId?: SkinId;
  shimmerPhase?: number; // 0..1 to drive shimmer/galaxy animation
  flameTick?: number; // 0..1 to drive flame flicker
};

function PaperPlaneImpl({
  size = 80,
  tilt = 0,
  pitch = 0,
  skinId = "origami",
  shimmerPhase = 0,
  flameTick = 0,
}: Props) {
  const skin: Skin = SKINS[skinId] || SKINS.origami;
  const rotateZ = `${tilt * 22}deg`;
  const rotateX = `${pitch * 14}deg`;
  const p = skin.palette;

  // Compute shimmer-driven gradient stops for "shimmer" flair (Aurora)
  const shimmerStops =
    skin.flair === "shimmer" && p.gradient
      ? p.gradient.map((c, i) => {
          const offset =
            (((i / Math.max(1, p.gradient!.length - 1)) + shimmerPhase) % 1);
          return { c, offset };
        }).sort((a, b) => a.offset - b.offset)
      : null;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ perspective: 600 }, { rotateZ }, { rotateX }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`light-${skin.id}`} x1="0" y1="0" x2="1" y2="1">
            {shimmerStops
              ? shimmerStops.map((s, i) => (
                  <Stop key={i} offset={s.offset} stopColor={s.c} />
                ))
              : [
                  <Stop key="a" offset="0" stopColor={p.wingLight} />,
                  <Stop
                    key="b"
                    offset="1"
                    stopColor={shadeMix(p.wingLight, p.wingDark, 0.35)}
                  />,
                ]}
          </LinearGradient>
          <LinearGradient id={`dark-${skin.id}`} x1="0" y1="0" x2="1" y2="1">
            {shimmerStops
              ? shimmerStops.map((s, i) => (
                  <Stop
                    key={i}
                    offset={s.offset}
                    stopColor={shadeMix(s.c, "#0F172A", 0.25)}
                  />
                ))
              : [
                  <Stop key="a" offset="0" stopColor={p.wingDark} />,
                  <Stop
                    key="b"
                    offset="1"
                    stopColor={shadeMix(p.wingDark, "#0F172A", 0.3)}
                  />,
                ]}
          </LinearGradient>
          {skin.flair === "flame" && (
            <LinearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FCD34D" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#F97316" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#DC2626" stopOpacity="0" />
            </LinearGradient>
          )}
        </Defs>

        {/* Glow halo for rare skins (Aurora / Phoenix / Galaxy) */}
        {skin.tier === "rare" && p.glow && (
          <Circle cx="50" cy="50" r="46" fill={p.glow} opacity={0.18} />
        )}

        {/* Cast shadow */}
        <Path
          d="M22 92 Q50 100 78 92 Q50 96 22 92 Z"
          fill="rgba(15,23,42,0.18)"
        />

        {/* Flame trail behind tail (flame flair only) */}
        {skin.flair === "flame" && (
          <>
            <Path
              d={`M50 88 Q${44 - flameTick * 4} ${94 + flameTick * 8} 50 ${
                100 + flameTick * 4
              } Q${56 + flameTick * 4} ${94 + flameTick * 8} 50 88 Z`}
              fill="url(#flame-grad)"
              opacity={0.85}
            />
            <Path
              d={`M50 86 Q${46 + (1 - flameTick) * 3} 92 50 ${96 + flameTick * 2} Q${
                54 - (1 - flameTick) * 3
              } 92 50 86 Z`}
              fill="#FFEDD5"
              opacity={0.7}
            />
          </>
        )}

        {/* Left wing (light) */}
        <Path
          d="M50 6 L8 86 L50 76 Z"
          fill={`url(#light-${skin.id})`}
          stroke={p.outline}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Right wing (dark) */}
        <Path
          d="M50 6 L92 86 L50 76 Z"
          fill={`url(#dark-${skin.id})`}
          stroke={p.outline}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Center fold ridge */}
        <Path
          d="M50 6 L50 76"
          stroke={p.outline}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        {/* Tail fin */}
        <Path
          d="M50 60 L42 88 L58 88 Z"
          fill={p.tailFin}
          opacity={0.95}
        />

        {/* Twinkle stars for galaxy flair */}
        {skin.flair === "galaxy" &&
          [
            [22, 30, 1.2],
            [70, 22, 1.4],
            [78, 50, 1.0],
            [30, 60, 1.1],
            [60, 70, 1.0],
          ].map(([cx, cy, r], i) => (
            <Circle
              key={i}
              cx={cx as number}
              cy={cy as number}
              r={r as number}
              fill="#F0F9FF"
              opacity={0.55 + Math.sin(shimmerPhase * Math.PI * 2 + i) * 0.4}
            />
          ))}
      </Svg>
    </View>
  );
}

// Cheap render guard: skip re-render when props are identical. The
// gameplay plane gets new tilt/pitch values every frame so it'll always
// re-render; the skin-grid previews change only on shimmerPhase, which
// helps when there are 7 instances on-screen at once.
const PaperPlane = memo(PaperPlaneImpl);
export default PaperPlane;

// Mix two hex colors, t = 0..1.
function shadeMix(a: string, b: string, t: number): string {
  const ah = hexToRgb(a);
  const bh = hexToRgb(b);
  const r = Math.round(ah.r * (1 - t) + bh.r * t);
  const g = Math.round(ah.g * (1 - t) + bh.g * t);
  const bl = Math.round(ah.b * (1 - t) + bh.b * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(v.substring(0, 2), 16),
    g: parseInt(v.substring(2, 4), 16),
    b: parseInt(v.substring(4, 6), 16),
  };
}
