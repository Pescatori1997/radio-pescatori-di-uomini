// Curated, elegant brand palettes. Only the ACCENT/brand tokens change; every
// background, text color and layout stays exactly as designed (safe by scope).
// The first entry ("sky") is the current default design.

export type Palette = {
  key: string;
  name: string;
  brandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  onBrandTertiary: string;
};

export const PALETTES: Palette[] = [
  { key: "sky", name: "Azzurro Cielo", brandPrimary: "#0EA5E9", brandSecondary: "#38BDF8", brandTertiary: "#E0F2FE", onBrandTertiary: "#0284C7" },
  { key: "ocean", name: "Blu Oceano", brandPrimary: "#2563EB", brandSecondary: "#60A5FA", brandTertiary: "#DBEAFE", onBrandTertiary: "#1D4ED8" },
  { key: "teal", name: "Teal Marino", brandPrimary: "#0D9488", brandSecondary: "#2DD4BF", brandTertiary: "#CCFBF1", onBrandTertiary: "#0F766E" },
  { key: "sage", name: "Verde Salvia", brandPrimary: "#059669", brandSecondary: "#34D399", brandTertiary: "#D1FAE5", onBrandTertiary: "#047857" },
  { key: "royal", name: "Porpora Regale", brandPrimary: "#7C3AED", brandSecondary: "#A78BFA", brandTertiary: "#EDE9FE", onBrandTertiary: "#6D28D9" },
  { key: "amber", name: "Ambra Caldo", brandPrimary: "#D97706", brandSecondary: "#FBBF24", brandTertiary: "#FEF3C7", onBrandTertiary: "#B45309" },
  { key: "rose", name: "Rosso Fuoco", brandPrimary: "#E11D48", brandSecondary: "#FB7185", brandTertiary: "#FFE4E6", onBrandTertiary: "#BE123C" },
];

export const DEFAULT_PALETTE_KEY = "sky";

export function resolvePalette(key?: string | null): Palette | undefined {
  if (!key) return undefined;
  return PALETTES.find((p) => p.key === key);
}
