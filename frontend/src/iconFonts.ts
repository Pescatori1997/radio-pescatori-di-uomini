// Central source of truth for @expo/vector-icons font families used on web.
//
// WHY THIS EXISTS
// On Chromium browsers (e.g. Android Chrome) @expo/vector-icons renders an icon,
// finds the font is not yet "loaded", and calls expo-font's loadAsync — which runs
// the `fontfaceobserver` polyfill with a hard 6000ms timeout. That observer detects
// a font by measuring text-width changes, which is unreliable for icon-only fonts
// (no Latin glyphs) and depends on the .ttf downloading within 6s. On slow networks
// / some mobile browsers it never resolves and rejects with "6000ms timeout
// exceeded", crashing the app (the rejection is uncaught inside vector-icons).
//
// FIX
// We pre-declare @font-face rules for every icon family inside the exact <style>
// element expo-font inspects (id="expo-generated-fonts"). Then Font.isLoaded(family)
// returns true on first render, vector-icons skips loadAsync entirely, and the
// fontfaceobserver polyfill never runs on ANY browser. Fonts load natively via CSS
// with font-display:swap (graceful fallback, never blocks or crashes).
//
// The keys below are the exact font-family names @expo/vector-icons uses internally
// (the 2nd arg to createIconSet). ICON_VECTOR_VERSION must match @expo/vector-icons
// in package.json.

export const ICON_VECTOR_VERSION = "15.1.1";

// internal font-family name (queried by the library) -> CDN .ttf file base name
export const ICON_FAMILY_FILES: Record<string, string> = {
  anticon: "AntDesign",
  entypo: "Entypo",
  evilicons: "EvilIcons",
  feather: "Feather",
  FontAwesome: "FontAwesome",
  Fontisto: "Fontisto",
  foundation: "Foundation",
  ionicons: "Ionicons",
  "material-community": "MaterialCommunityIcons",
  material: "MaterialIcons",
  octicons: "Octicons",
  "simple-line-icons": "SimpleLineIcons",
  zocial: "Zocial",
  // FontAwesome5 multi-style variants (Light falls back to the Regular file)
  "FontAwesome5Free-Regular": "FontAwesome5_Regular",
  "FontAwesome5Free-Light": "FontAwesome5_Regular",
  "FontAwesome5Free-Solid": "FontAwesome5_Solid",
  "FontAwesome5Free-Brand": "FontAwesome5_Brands",
  // FontAwesome6 multi-style variants
  "FontAwesome6Free-Regular": "FontAwesome6_Regular",
  "FontAwesome6Free-Light": "FontAwesome6_Regular",
  "FontAwesome6Free-Solid": "FontAwesome6_Solid",
  "FontAwesome6Free-Brand": "FontAwesome6_Brands",
};

export const iconCdnUrl = (file: string): string =>
  `https://cdn.jsdelivr.net/npm/@expo/vector-icons@${ICON_VECTOR_VERSION}/build/vendor/react-native-vector-icons/Fonts/${file}.ttf`;

// family -> url map (used by expo-font useFonts under Expo Go, where Metro returns
// 0-byte .ttf assets for @expo/vector-icons on Android).
export const iconFontMap = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ICON_FAMILY_FILES).map(([family, file]) => [family, iconCdnUrl(file)]),
  );

// Web-only: @font-face CSS injected into <head>. Generated to match expo-font's own
// _createWebFontTemplate output byte-for-byte (quoted family + quoted url) so that
// Font.isLoaded(family) — which does an exact `rule.style.fontFamily === family`
// comparison — returns true and the observer is skipped.
export const iconFontFaceCss = (): string =>
  Object.entries(ICON_FAMILY_FILES)
    .map(
      ([family, file]) =>
        `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(
          iconCdnUrl(file),
        )});font-display:swap}`,
    )
    .join("");

// Web-only runtime injector. The Expo dev server (and web.output:"single") serves a
// default HTML shell that does NOT run app/+html.tsx, so we also inject the icon
// @font-face rules at runtime — synchronously at module import time, before any icon
// component mounts. Populating the exact <style id="expo-generated-fonts"> element
// that expo-font inspects makes Font.isLoaded() return true, so @expo/vector-icons
// skips loadAsync and the fontfaceobserver 6000ms-timeout polyfill never runs.
// No-op on native (document is undefined).
export function ensureIconFontFaces(): void {
  if (typeof document === "undefined" || !document.head) return;
  const ID = "expo-generated-fonts";
  let el = document.getElementById(ID) as HTMLStyleElement | null;
  if (el && (el.textContent || "").includes("@font-face")) return;
  if (!el) {
    el = document.createElement("style");
    el.id = ID;
    el.type = "text/css";
    document.head.appendChild(el);
  }
  el.appendChild(document.createTextNode(iconFontFaceCss()));
}
