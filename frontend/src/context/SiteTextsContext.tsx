import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/src/api";
import { SITE_TEXT_DEFAULTS, SiteTextGroupKey } from "@/src/siteTexts";

type TextsShape = Record<string, Record<string, string>>;

type Ctx = {
  /** Returns the admin-defined text, or the original hardcoded fallback if empty. */
  st: (group: SiteTextGroupKey, key: string) => string;
  refresh: () => void;
};

const SiteTextsCtx = createContext<Ctx>({ st: (g, k) => SITE_TEXT_DEFAULTS[g]?.[k] ?? "", refresh: () => {} });

/**
 * App-wide provider for admin-editable UI texts (Phase 2: Home + Player).
 * Fetches /api/site-settings ONCE and caches the `texts` group. Every lookup
 * gracefully falls back to the original hardcoded string, so the app never
 * breaks even if the field is empty or the request fails.
 */
export function SiteTextsProvider({ children }: { children: React.ReactNode }) {
  const [texts, setTexts] = useState<TextsShape | null>(null);

  const refresh = useCallback(() => {
    api.siteSettings().then((d: any) => setTexts((d?.texts as TextsShape) || {})).catch(() => {});
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

  return <SiteTextsCtx.Provider value={{ st, refresh }}>{children}</SiteTextsCtx.Provider>;
}

export function useSiteText() {
  return useContext(SiteTextsCtx);
}
