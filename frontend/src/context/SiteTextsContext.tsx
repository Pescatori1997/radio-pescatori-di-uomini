import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/src/api";
import { SITE_TEXT_DEFAULTS, SiteTextGroupKey } from "@/src/siteTexts";
import { cachePaletteKey } from "@/src/appearance";

type TextsShape = Record<string, Record<string, string>>;
type SectionsShape = Record<string, Record<string, string>>;

export type SectionMeta = { name?: string; subtitle?: string; description?: string; image?: string };

type Ctx = {
  /** Returns the admin-defined text, or the original hardcoded fallback if empty. */
  st: (group: SiteTextGroupKey, key: string) => string;
  /** Returns the stored metadata object for a section (may be empty). */
  sm: (key: string) => SectionMeta;
  refresh: () => void;
};

const SiteTextsCtx = createContext<Ctx>({
  st: (g, k) => SITE_TEXT_DEFAULTS[g]?.[k] ?? "",
  sm: () => ({}),
  refresh: () => {},
});

/**
 * App-wide provider for admin-editable UI texts + section metadata.
 * Fetches /api/site-settings ONCE and caches the `texts` and `sections` groups.
 * Every lookup gracefully falls back (empty/missing = original hardcoded value),
 * so the app never breaks even if a field is empty or the request fails.
 */
export function SiteTextsProvider({ children }: { children: React.ReactNode }) {
  const [texts, setTexts] = useState<TextsShape | null>(null);
  const [sections, setSections] = useState<SectionsShape | null>(null);

  const refresh = useCallback(() => {
    api.siteSettings().then((d: any) => {
      setTexts((d?.texts as TextsShape) || {});
      setSections((d?.sections as SectionsShape) || {});
      // Cache the selected accent palette so it applies from the next app launch.
      const paletteKey = d?.appearance?.palette;
      if (typeof paletteKey === "string" && paletteKey) cachePaletteKey(paletteKey);
    }).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const st = useCallback(
    (group: SiteTextGroupKey, key: string) => {
      const v = texts?.[group]?.[key];
      if (typeof v === "string" && v.trim().length > 0) return v;
      return SITE_TEXT_DEFAULTS[group]?.[key] ?? "";
    },
    [texts]
  );

  const sm = useCallback(
    (key: string): SectionMeta => {
      const raw = sections?.[key] || {};
      const clean: SectionMeta = {};
      (["name", "subtitle", "description", "image"] as const).forEach((f) => {
        const v = (raw as any)[f];
        if (typeof v === "string" && v.trim().length > 0) clean[f] = v;
      });
      return clean;
    },
    [sections]
  );

  return <SiteTextsCtx.Provider value={{ st, sm, refresh }}>{children}</SiteTextsCtx.Provider>;
}

export function useSiteText() {
  return useContext(SiteTextsCtx);
}
