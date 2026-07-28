import { useWindowDimensions } from "react-native";

// Breakpoint above which we treat the viewport as desktop/tablet (landscape thumbs).
export const THUMB_DESKTOP_BREAKPOINT = 768;

// Responsive thumbnail aspect ratios.
export const THUMB_ASPECT_DESKTOP = 16 / 9; // wide, elegant on large screens
export const THUMB_ASPECT_MOBILE = 4 / 5; // portrait, taller cards on phones

/**
 * Single source of truth for card/thumbnail aspect ratios across the app
 * (public screens + admin previews). Reacts to resize/rotation.
 *   - Desktop / tablet (width >= 768): 16:9
 *   - Phones (width < 768): 4:5 (portrait)
 * Images are rendered with contentFit="cover", so existing 16:9 assets remain
 * fully compatible (they are simply centre-cropped to the active ratio).
 */
export function useThumbAspect(): number {
  const { width } = useWindowDimensions();
  return width >= THUMB_DESKTOP_BREAKPOINT ? THUMB_ASPECT_DESKTOP : THUMB_ASPECT_MOBILE;
}
