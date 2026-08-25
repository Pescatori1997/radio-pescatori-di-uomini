// Custom app entry.
//
// IMPORTANT (Android/iOS release builds): the root component MUST be registered
// SYNCHRONOUSLY during initial bundle evaluation. The native runtime calls
// runApplication("main") right after the JS bundle loads; if registration is
// deferred (e.g. inside a Promise callback) the release app crashes on launch
// with "Application 'main' has not been registered". So on native we require
// expo-router/entry synchronously and apply the saved accent palette
// best-effort (it takes effect from the next launch).
//
// On web the registration can be deferred safely, so we apply the palette
// before the first paint (instant theming).
import { Platform } from "react-native";
import { loadAndApplyCachedPalette } from "./src/appearance";

if (Platform.OS === "web") {
  loadAndApplyCachedPalette().finally(() => {
    require("expo-router/entry");
  });
} else {
  loadAndApplyCachedPalette();
  require("expo-router/entry");
}
