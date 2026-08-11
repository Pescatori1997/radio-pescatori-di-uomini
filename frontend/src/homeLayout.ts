// Home layout personalization model (configured from the Admin panel).
// Each Home section can be reordered, set to full/half width (two halves sit
// side by side) and scaled (compact/normal/large). Adding a new Home section =
// add one entry to HOME_SECTIONS; it defaults to full/normal at the end.

export type HomeWidth = "full" | "half";
export type HomeSize = "compact" | "normal" | "large";
export type HomeSectionCfg = { key: string; width: HomeWidth; size: HomeSize };

export const HOME_SECTIONS: { key: string; label: string }[] = [
  { key: "meteo", label: "Meteo" },
  { key: "community", label: "Statistiche Community" },
  { key: "podcast", label: "Ultimi Podcast" },
  { key: "vetrina", label: "Vetrina" },
  { key: "palinsesto", label: "Palinsesto" },
  { key: "team", label: "Il nostro Team" },
  { key: "whatsapp", label: "Scrivici su WhatsApp" },
  { key: "verse", label: "Versetto del Giorno" },
  { key: "bibbia", label: "Leggi la Bibbia" },
  { key: "piani", label: "Piani di Lettura" },
  { key: "traguardi", label: "Traguardi del Cammino" },
  { key: "prayer", label: "Richieste di Preghiera" },
];

export const DEFAULT_HOME_LAYOUT: HomeSectionCfg[] = HOME_SECTIONS.map((s) => ({
  key: s.key, width: "full", size: "normal",
}));

const SIZES: HomeSize[] = ["compact", "normal", "large"];

/** Uniform scale factor. Kept conservative so full-width "large" never overflows
 * the screen and half-width cells never overlap their sibling. */
export function scaleFor(width: HomeWidth, size: HomeSize): number {
  if (width === "half") return size === "compact" ? 0.9 : 1; // don't enlarge inside a half cell
  return size === "compact" ? 0.9 : size === "large" ? 1.08 : 1;
}

/** Merge the stored layout with the canonical section list: keep the stored
 * order, drop unknown keys, append any new/missing sections at the end. */
export function mergeHomeLayout(stored?: any[] | null): HomeSectionCfg[] {
  const valid = new Set(HOME_SECTIONS.map((s) => s.key));
  const seen = new Set<string>();
  const out: HomeSectionCfg[] = [];
  (Array.isArray(stored) ? stored : []).forEach((it) => {
    if (it && valid.has(it.key) && !seen.has(it.key)) {
      seen.add(it.key);
      out.push({
        key: it.key,
        width: it.width === "half" ? "half" : "full",
        size: SIZES.includes(it.size) ? it.size : "normal",
      });
    }
  });
  HOME_SECTIONS.forEach((s) => {
    if (!seen.has(s.key)) out.push({ key: s.key, width: "full", size: "normal" });
  });
  return out;
}
