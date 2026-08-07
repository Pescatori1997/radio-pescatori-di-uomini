import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/src/api";

type SettingsShape = { section_visibility?: Record<string, boolean>; [k: string]: any };

type Ctx = {
  settings: SettingsShape | null;
  /** True unless the admin explicitly turned the section off. */
  sectionVisible: (key: string) => boolean;
  refresh: () => void;
};

const SettingsCtx = createContext<Ctx>({ settings: null, sectionVisible: () => true, refresh: () => {} });

/**
 * Lightweight app-wide settings provider. Fetches /api/settings ONCE and caches
 * it, so the section on/off toggles (managed from the Admin panel) are respected
 * everywhere — bottom tabs, Home cards and the Profile menu — without adding
 * repeated network calls.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsShape | null>(null);

  const refresh = useCallback(() => {
    api.settings().then((d: any) => setSettings(d || {})).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sectionVisible = useCallback(
    (key: string) => settings?.section_visibility?.[key] !== false,
    [settings]
  );

  return <SettingsCtx.Provider value={{ settings, sectionVisible, refresh }}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  return useContext(SettingsCtx);
}
