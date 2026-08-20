// Centralized, extensible schema for admin-editable site texts.
// Phase 2 covers Home + Player. Add new groups/fields here and they become
// editable in the Admin panel AND readable in the app via useSiteText().
// The `default` value is the SAFE FALLBACK: if the admin leaves a field empty
// (or the field was never saved), the app shows exactly the original text.

export type SiteTextField = { key: string; label: string; default: string; multiline?: boolean };
export type SiteTextGroupKey = "home" | "player";
export type SiteTextGroup = { group: SiteTextGroupKey; title: string; hint?: string; fields: SiteTextField[] };

export const SITE_TEXT_SCHEMA: SiteTextGroup[] = [
  {
    group: "home",
    title: "Home",
    hint: "Testi della schermata iniziale (hero, pulsanti, sezioni).",
    fields: [
      { key: "brand_name", label: "Nome radio (hero)", default: "Pescatori di Uomini" },
      { key: "slogan", label: "Slogan (hero)", default: "La radio che annuncia il Vangelo" },
      { key: "badge_live_mode", label: "Badge diretta streaming", default: "IN DIRETTA" },
      { key: "badge_live", label: "Badge radio in onda", default: "IN DIRETTA ORA" },
      { key: "badge_offline", label: "Badge non in onda", default: "NON IN ONDA" },
      { key: "live_now_title", label: "Titolo diretta attiva", default: "🔴 Siamo in diretta" },
      { key: "live_now_sub", label: "Sottotitolo diretta attiva", default: "Guarda la diretta streaming ora in corso" },
      { key: "cta_watch_live", label: "Pulsante guarda diretta", default: "Guarda la diretta" },
      { key: "now_label", label: "Etichetta 'ora in onda'", default: "ORA IN ONDA" },
      { key: "cta_listen", label: "Pulsante ascolta diretta", default: "Ascolta la Diretta" },
      { key: "cta_listening", label: "Pulsante in riproduzione", default: "In riproduzione" },
      { key: "see_all", label: "Link 'Vedi tutti'", default: "Vedi tutti" },
      { key: "schedule_btn", label: "Pulsante visualizza palinsesto", default: "Visualizza palinsesto" },
      { key: "no_program_title", label: "Palinsesto: nessun programma", default: "Nessun programma in onda" },
      { key: "no_program_sub", label: "Palinsesto: sottotitolo vuoto", default: "Visualizza il palinsesto completo" },
      { key: "prayer_cta", label: "Pulsante richiesta di preghiera", default: "Invia una richiesta di preghiera" },
      { key: "board_title", label: "Titolo bacheca preghiere", default: "Bacheca delle Richieste di Preghiera" },
      { key: "board_sub", label: "Sottotitolo bacheca preghiere", default: "Prega per i tuoi fratelli e sorelle" },
    ],
  },
  {
    group: "player",
    title: "Player",
    hint: "Testi del lettore audio a schermo intero (diretta e podcast).",
    fields: [
      { key: "top_label_live", label: "Etichetta in alto (diretta)", default: "DIRETTA RADIO" },
      { key: "top_label_podcast", label: "Etichetta in alto (podcast)", default: "PODCAST" },
      { key: "tag_live", label: "Tag in diretta", default: "IN DIRETTA" },
      { key: "tag_reconnecting", label: "Tag riconnessione", default: "RICONNESSIONE..." },
      { key: "tag_offline", label: "Tag non in onda", default: "NON IN ONDA" },
      { key: "on_air_now", label: "Etichetta 'in onda adesso'", default: "IN ONDA ADESSO" },
      { key: "on_air_next", label: "Etichetta 'in onda dopo'", default: "IN ONDA DOPO" },
      { key: "recent_songs", label: "Etichetta ultimi brani", default: "ULTIMI BRANI TRASMESSI" },
      { key: "no_data", label: "Messaggio nessun dato", default: "Nessun dato disponibile" },
      { key: "empty", label: "Messaggio nessun contenuto", default: "Nessun contenuto in riproduzione" },
      { key: "close", label: "Pulsante chiudi", default: "Chiudi" },
    ],
  },
];

/** Map of { group: { key: default } } used as the safe fallback everywhere. */
export const SITE_TEXT_DEFAULTS: Record<string, Record<string, string>> = SITE_TEXT_SCHEMA.reduce(
  (acc, g) => {
    acc[g.group] = g.fields.reduce((f, field) => { f[field.key] = field.default; return f; }, {} as Record<string, string>);
    return acc;
  },
  {} as Record<string, Record<string, string>>
);
