import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="skins" />
        <Stack.Screen name="crates" />
        <Stack.Screen name="leaderboard" />
      </Stack>
    </GestureHandlerRootView>
  );
}
