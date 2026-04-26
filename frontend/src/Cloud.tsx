import React from "react";
import Svg, { Path } from "react-native-svg";
import { View } from "react-native";

type Props = {
  width: number;
  height: number;
  fill?: string;
  opacity?: number;
};

// Puffy multi-bump cloud with subtle highlight, drawn at 200x80 viewBox.
export default function Cloud({
  width,
  height,
  fill = "#FFFFFF",
  opacity = 1,
}: Props) {
  return (
    <View style={{ width, height, opacity }}>
      <Svg width={width} height={height} viewBox="0 0 200 80">
        {/* Body */}
        <Path
          d="M30 60
             Q15 60 15 48
             Q15 32 32 30
             Q36 14 56 16
             Q66 4 84 10
             Q98 0 118 10
             Q140 4 150 22
             Q172 22 178 38
             Q190 42 188 56
             Q186 66 172 66
             L40 66
             Q30 66 30 60 Z"
          fill={fill}
        />
        {/* Subtle highlight */}
        <Path
          d="M50 28 Q70 18 92 22 Q72 18 50 28 Z"
          fill="rgba(255,255,255,0.85)"
          opacity={0.6}
        />
      </Svg>
    </View>
  );
}
