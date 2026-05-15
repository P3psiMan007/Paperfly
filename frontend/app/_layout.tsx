import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Sentry from "@sentry/react-native";

// Crash + error reporting. DSN is optional at dev time — set
// EXPO_PUBLIC_SENTRY_DSN in your env to enable. Without it, Sentry's
// init() is a safe no-op (no network calls, no PII shipped anywhere).
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Surface a stack trace in dev so we can read it during testing.
    debug: __DEV__,
    // Only report non-dev builds upstream by default; flip to true if you
    // want to see your own development errors in the Sentry dashboard.
    enabled: !__DEV__,
    // Sample rate of 1.0 = 100% of errors reported. For a small game with
    // few users this is fine; turn it down later if you hit Sentry quotas.
    sampleRate: 1.0,
    // Performance tracing is heavier; sample lightly to start.
    tracesSampleRate: 0.1,
  });
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="skins" />
      </Stack>
    </GestureHandlerRootView>
  );
}

// Wrap the root so any uncaught render error is captured by Sentry and
// shown a fallback instead of the bare red screen.
export default Sentry.wrap(RootLayout);
