// Icon font loader for Expo apps.
//
// - Expo Go (StoreClient): @expo/vector-icons' .ttf files come back as 0 bytes from
//   Metro's asset resolver on Android, so we load them from a CDN via useFonts.
// - Native dev/prod builds: react-native-vector-icons autolinking handles fonts, so
//   we pass an empty map and useFonts resolves immediately.
// - Web: we DON'T load fonts here. Instead the @font-face rules are pre-injected in
//   app/+html.tsx so @expo/vector-icons never runs the fontfaceobserver polyfill
//   (which crashes with "6000ms timeout exceeded" on some Chromium browsers).
//   See src/iconFonts.ts for the full explanation.
//
// Usage: const [loaded, error] = useIconFonts();

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";
import { iconFontMap } from "@/src/iconFonts";

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? iconFontMap()
      : {},
  );
