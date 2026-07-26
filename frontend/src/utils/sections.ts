// Central configuration for the Universal CMS sections.
// Add a new section here (and its key in the backend CONTENT_SECTIONS) to enable it
// across the Admin panel and the public "Biblioteca" — no screen rewrite required.

export type SectionDef = {
  key: string;
  label: string;
  icon: string;        // MaterialCommunityIcons name
  description: string;
  hint?: string;       // help text shown in the admin editor
};

// Sections managed by the generic CMS engine (contents collection).
export const CMS_SECTIONS: SectionDef[] = [
  { key: "studi-biblici", label: "Studi Biblici", icon: "book-open-page-variant", description: "Approfondimenti sulla Parola", hint: "Studi e dispense: video, audio, PDF o link esterni." },
  { key: "predicazioni", label: "Predicazioni", icon: "bullhorn-variant", description: "Sermoni e messaggi", hint: "Sermoni e messaggi: video, audio o link esterni." },
  { key: "video", label: "Video", icon: "video-vintage", description: "Contenuti video", hint: "Video caricati o da YouTube, Vimeo, Facebook, ecc." },
];

// Full label map for every backend section (used by the shared admin list/editor).
export const SECTION_LABEL: Record<string, string> = {
  "studi-biblici": "Studi Biblici",
  predicazioni: "Predicazioni",
  video: "Video",
  eventi: "Eventi",
  galleria: "Galleria",
  download: "Download PDF",
};

export const SECTION_ICON: Record<string, string> = {
  "studi-biblici": "book-open-page-variant",
  predicazioni: "bullhorn-variant",
  video: "video-vintage",
  eventi: "calendar-star",
  galleria: "image-multiple",
  download: "file-pdf-box",
};

export const sectionLabel = (key?: string) => (key && SECTION_LABEL[key]) || "Contenuti";
export const sectionIcon = (key?: string) => (key && SECTION_ICON[key]) || "folder-outline";
export const sectionHint = (key?: string) =>
  CMS_SECTIONS.find((s) => s.key === key)?.hint || "Carica un file (audio, video, immagine, PDF) oppure incolla un link esterno.";

// Public "Biblioteca" categories. Legacy modules (Podcast, Meditazioni) keep their own
// dedicated screens; CMS sections route to the generic /c/[section] list.
export type LibraryCategory = { key: string; label: string; icon: string; description: string; route: string };

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { key: "podcast", label: "Podcast", icon: "microphone", description: "Ascolta gli episodi", route: "/podcast" },
  { key: "meditazioni", label: "Meditazioni", icon: "book-open-variant", description: "Video meditazioni per la fede", route: "/meditazioni" },
  ...CMS_SECTIONS.map((s) => ({ key: s.key, label: s.label, icon: s.icon, description: s.description, route: `/c/${s.key}` })),
];
