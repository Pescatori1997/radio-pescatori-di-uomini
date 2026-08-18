import { useSettings } from "@/src/context/SettingsContext";

/**
 * Central catalog of renamable app section labels. The admin can override any of
 * these from Pannello Admin → Nomi delle sezioni. Values are stored in
 * settings.section_labels (key -> custom label) and applied live.
 *
 * `group` is only used to organize the admin editor.
 */
export type LabelDef = { key: string; def: string; group: string };

export const LABEL_CATALOG: LabelDef[] = [
  // Biblioteca
  { key: "library_title", def: "Contenuti", group: "Biblioteca" },
  // Menu Profilo ("Altro")
  { key: "menu_team", def: "Il nostro Team", group: "Menu Profilo" },
  { key: "menu_traguardi", def: "Traguardi del Cammino", group: "Menu Profilo" },
  { key: "menu_biblioteca", def: "Biblioteca", group: "Menu Profilo" },
  { key: "menu_prayer", def: "Richieste di Preghiera", group: "Menu Profilo" },
  { key: "menu_merch", def: "Merchandising", group: "Menu Profilo" },
  { key: "menu_about", def: "Chi Siamo", group: "Menu Profilo" },
  { key: "menu_donate", def: "Sostieni il progetto", group: "Menu Profilo" },
  { key: "menu_contact", def: "Contatti", group: "Menu Profilo" },
  // Home (titoli delle sezioni nella schermata principale)
  { key: "home_podcast", def: "Ultimi Podcast", group: "Home" },
  { key: "home_palinsesto", def: "Palinsesto", group: "Home" },
  { key: "home_bibbia", def: "Leggi la Bibbia", group: "Home" },
  { key: "home_piani", def: "Piani di Lettura", group: "Home" },
  { key: "home_traguardi", def: "Traguardi del Cammino", group: "Home" },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(LABEL_CATALOG.map((l) => [l.key, l.def]));

/** Hook returning a translator: t(key) -> custom label or catalog default. */
export function useLabel() {
  const { settings } = useSettings();
  const overrides: Record<string, string> = (settings?.section_labels as any) || {};
  return (key: string, fallback?: string) => {
    const v = overrides[key];
    if (v && String(v).trim()) return v;
    return DEFAULTS[key] ?? fallback ?? key;
  };
}
