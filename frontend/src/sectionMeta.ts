// Catalog of app sections whose METADATA (display name, subtitle, description,
// cover image) can be edited by the admin from Pannello Admin → Metadati sezione.
// Values are stored in site_settings.sections[key]. Visibility (ON/OFF) reuses
// the existing GeneralSettings.section_visibility system (single source of truth,
// already consumed by tabs/Home/Profilo), so nothing else needs re-wiring.
//
// IMPORTANT: only fields that are actually wired to a screen are listed here as
// supported, so the admin never edits a field that has no visible effect.

export type SectionMetaDef = {
  key: string; // key used in site_settings.sections AND as sm(key)
  label: string; // admin-facing section label
  visKey?: string; // matching section_visibility key (existing), if any
  defaultName: string; // fallback header title
  defaultSubtitle?: string; // fallback subtitle (screens that already show one)
  supportsSubtitle?: boolean;
  supportsDescription?: boolean;
  supportsImage?: boolean;
  hint?: string;
};

export const SECTION_META_CATALOG: SectionMetaDef[] = [
  { key: "podcast", label: "Podcast", visKey: "podcast", defaultName: "Podcast", supportsSubtitle: true, supportsDescription: true, supportsImage: true, hint: "Titolo, sottotitolo, descrizione e copertina in cima alla schermata Podcast." },
  { key: "news", label: "Notizie", visKey: "news", defaultName: "Notizie", supportsSubtitle: true, supportsDescription: true, supportsImage: true, hint: "Intestazione della schermata Notizie." },
  { key: "palinsesto", label: "Palinsesto", visKey: "palinsesto", defaultName: "PALINSESTO", supportsSubtitle: true, hint: "Etichetta e sottotitolo in cima al Palinsesto." },
  { key: "merch", label: "Merchandising", visKey: "merch", defaultName: "Merchandising", defaultSubtitle: "Indossa la missione. Ogni acquisto sostiene Radio Pescatori di Uomini e contribuisce alla diffusione del Vangelo.", supportsSubtitle: true, hint: "Titolo e descrizione della vetrina Merchandising." },
  { key: "prayer", label: "Richieste di Preghiera", visKey: "prayer", defaultName: "Richiesta di Preghiera", defaultSubtitle: "Condividi ciò che hai nel cuore. La tua richiesta arriverà al nostro team di preghiera.", supportsSubtitle: true, hint: "Titolo e introduzione del modulo Richiesta di Preghiera." },
  { key: "prayer_board", label: "Bacheca delle Preghiere", visKey: "prayer", defaultName: "Bacheca di Preghiera", defaultSubtitle: "❤️ Preghiamo gli uni per gli altri", supportsSubtitle: true, hint: "Titolo e sottotitolo della Bacheca pubblica delle preghiere." },
  { key: "messages", label: "Messaggi & Testimonianze", defaultName: "Messaggi", supportsSubtitle: true, hint: "Intestazione della schermata Messaggi." },
  { key: "contact", label: "Contatti", visKey: "contact", defaultName: "Contatti", supportsSubtitle: true, hint: "Intestazione della schermata Contatti." },
  { key: "biblioteca", label: "Biblioteca", defaultName: "Biblioteca", defaultSubtitle: "Qui trovi i contenuti che hai messo tra i preferiti, ordinati per cartella.", supportsSubtitle: true, hint: "Sottotitolo della Biblioteca (il nome si gestisce anche in Nomi delle sezioni)." },
];
