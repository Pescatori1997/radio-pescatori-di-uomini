// Custom app entry: apply the admin-selected accent palette to the shared theme
// BEFORE the router and any screen StyleSheet is evaluated. This keeps the whole
// app consistent with zero per-screen refactor. Falls back to the default design
// if nothing is cached. See src/appearance.ts and src/palettes.ts.
import { loadAndApplyCachedPalette } from "./src/appearance";

loadAndApplyCachedPalette().finally(() => {
  require("expo-router/entry");
});
