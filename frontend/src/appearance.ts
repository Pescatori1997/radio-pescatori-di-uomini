import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/src/theme";
import { resolvePalette, Palette } from "@/src/palettes";

// Local cache key: the selected palette is seeded from here at app entry
// (see index.js) BEFORE any screen StyleSheet is created, so the accent color
// is applied consistently app-wide with zero per-screen refactor.
export const APPEARANCE_KEY = "pdu_appearance_palette";

/** Mutate the shared theme `colors` object in place with a palette's accents. */
export function applyPalette(p?: Palette) {
  if (!p) return;
  colors.brandPrimary = p.brandPrimary;
  colors.brandSecondary = p.brandSecondary;
  colors.brandTertiary = p.brandTertiary;
  colors.onBrandTertiary = p.onBrandTertiary;
}

/** Persist the chosen palette key so it applies from the next app launch. */
export async function cachePaletteKey(key: string) {
  try { await AsyncStorage.setItem(APPEARANCE_KEY, key || ""); } catch {}
}

/** Read cached key + apply immediately (used at bootstrap). */
export async function loadAndApplyCachedPalette() {
  try {
    const key = await AsyncStorage.getItem(APPEARANCE_KEY);
    applyPalette(resolvePalette(key));
  } catch {}
}
