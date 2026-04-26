import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

type Props = {
  size?: number;
  tilt?: number; // -1..1 roll (visual)
  pitch?: number; // -1..1 pitch (visual)
};

// Crisp origami paper plane via SVG. Two-tone shading + dark fold + tail fin.
export default function PaperPlane({ size = 80, tilt = 0, pitch = 0 }: Props) {
  const rotateZ = `${tilt * 22}deg`;
  const rotateX = `${pitch * 14}deg`;

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
          <LinearGradient id="lightFold" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#F1F5F9" />
          </LinearGradient>
          <LinearGradient id="darkFold" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#E2E8F0" />
            <Stop offset="1" stopColor="#CBD5E1" />
          </LinearGradient>
        </Defs>

        {/* Soft cast shadow under plane */}
        <Path
          d="M22 92 Q50 100 78 92 Q50 96 22 92 Z"
          fill="rgba(15,23,42,0.18)"
        />

        {/* Left wing (light) */}
        <Path
          d="M50 6 L8 86 L50 76 Z"
          fill="url(#lightFold)"
          stroke="#0F172A"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Right wing (dark) */}
        <Path
          d="M50 6 L92 86 L50 76 Z"
          fill="url(#darkFold)"
          stroke="#0F172A"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Center fold ridge */}
        <Path
          d="M50 6 L50 76"
          stroke="#0F172A"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        {/* Tail fin */}
        <Path
          d="M50 60 L42 88 L58 88 Z"
          fill="#0F172A"
          opacity={0.92}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
