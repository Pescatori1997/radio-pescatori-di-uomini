import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { AppState, Platform, Linking } from "react-native";
import * as Location from "expo-location";
import { storage } from "@/src/utils/storage";
import { fetchWeather, reverseGeocode, WeatherData, CityRef } from "@/src/weather/weatherApi";

const K_PREFS = "weather_prefs";       // { useDeviceLocation, city }
const K_CACHE = "weather_cache";       // { weather, city, ts }
const K_PERM_ASKED = "weather_perm_asked";
const REFRESH_MS = 45 * 60 * 1000;     // 45 min auto-refresh
const STALE_MS = 90 * 60 * 1000;

export type WeatherStatus = "loading" | "ok" | "need_setup" | "error";

type Ctx = {
  status: WeatherStatus;
  weather: WeatherData | null;
  city: CityRef | null;
  useDeviceLocation: boolean;
  lastUpdated: number | null;
  offline: boolean;
  permAsked: boolean;
  requestLocation: () => Promise<boolean>;
  selectCity: (c: CityRef) => Promise<void>;
  enableDeviceLocation: () => Promise<void>;
  disableDeviceLocation: () => void;
  refresh: () => Promise<void>;
};

const WeatherCtx = createContext<Ctx>(null as any);
export const useWeather = () => useContext(WeatherCtx);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WeatherStatus>("loading");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [city, setCity] = useState<CityRef | null>(null);
  const [useDeviceLocation, setUseDev] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [permAsked, setPermAsked] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef(0);

  const persistPrefs = async (useDev: boolean, c: CityRef | null) => {
    await storage.setItem(K_PREFS, { useDeviceLocation: useDev, city: c });
  };

  const loadFor = useCallback(async (c: CityRef, markSource: "gps" | "city") => {
    try {
      const w = await fetchWeather(c.latitude, c.longitude);
      const ts = Date.now();
      setWeather(w); setCity(c); setLastUpdated(ts); setOffline(false); setStatus("ok");
      await storage.setItem(K_CACHE, { weather: w, city: c, ts });
      lastFetchRef.current = ts;
    } catch {
      // Network/service error — fall back to cache if available.
      const cache = await storage.getItem<any>(K_CACHE, null);
      if (cache?.weather) {
        setWeather(cache.weather); setCity(cache.city); setLastUpdated(cache.ts); setOffline(true); setStatus("ok");
      } else {
        setStatus("error");
      }
    }
  }, []);

  const resolveDeviceLocation = useCallback(async (): Promise<boolean> => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const c = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      await loadFor(c, "gps");
      return true;
    } catch {
      const cache = await storage.getItem<any>(K_CACHE, null);
      if (cache?.weather) { setWeather(cache.weather); setCity(cache.city); setLastUpdated(cache.ts); setOffline(true); setStatus("ok"); }
      else setStatus("need_setup");
      return false;
    }
  }, [loadFor]);

  // Initial load
  useEffect(() => {
    (async () => {
      const asked = await storage.getItem<boolean>(K_PERM_ASKED, false);
      setPermAsked(!!asked);
      const prefs = await storage.getItem<any>(K_PREFS, null);
      const cache = await storage.getItem<any>(K_CACHE, null);
      // Show cached data instantly for a fast paint.
      if (cache?.weather) { setWeather(cache.weather); setCity(cache.city); setLastUpdated(cache.ts); setStatus("ok"); }

      if (prefs?.useDeviceLocation) {
        setUseDev(true);
        const { status: perm } = await Location.getForegroundPermissionsAsync();
        if (perm === "granted") { await resolveDeviceLocation(); return; }
        // permission lost -> fall back to saved city or setup
      }
      if (prefs?.city) { setCity(prefs.city); await loadFor(prefs.city, "city"); return; }
      if (!cache?.weather) setStatus("need_setup");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh (throttled) + refresh on app foreground.
  const refresh = useCallback(async () => {
    if (Date.now() - lastFetchRef.current < 60 * 1000) return; // avoid bursts
    if (useDeviceLocation) {
      const { status: perm } = await Location.getForegroundPermissionsAsync();
      if (perm === "granted") { await resolveDeviceLocation(); return; }
    }
    if (city) await loadFor(city, "city");
  }, [useDeviceLocation, city, loadFor, resolveDeviceLocation]);

  useEffect(() => {
    timer.current = setInterval(() => { refresh(); }, REFRESH_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && lastUpdated && Date.now() - lastUpdated > STALE_MS) refresh();
    });
    return () => { if (timer.current) clearInterval(timer.current); sub.remove(); };
  }, [refresh, lastUpdated]);

  const requestLocation = useCallback(async (): Promise<boolean> => {
    let current = await Location.getForegroundPermissionsAsync();
    if (current.status !== "granted" && current.canAskAgain) {
      current = await Location.requestForegroundPermissionsAsync();
    }
    await storage.setItem(K_PERM_ASKED, true);
    setPermAsked(true);
    if (current.status === "granted") {
      setUseDev(true);
      await persistPrefs(true, city);
      const ok = await resolveDeviceLocation();
      return ok;
    }
    // Denied / blocked
    if (!current.canAskAgain && Platform.OS !== "web") {
      Linking.openSettings().catch(() => {});
    }
    if (!city && !weather) setStatus("need_setup");
    return false;
  }, [city, weather, resolveDeviceLocation]);

  const selectCity = useCallback(async (c: CityRef) => {
    setUseDev(false);
    await persistPrefs(false, c);
    setStatus("loading");
    await loadFor(c, "city");
  }, [loadFor]);

  const enableDeviceLocation = useCallback(async () => {
    await requestLocation();
  }, [requestLocation]);

  const disableDeviceLocation = useCallback(() => {
    setUseDev(false);
    persistPrefs(false, city);
  }, [city]);

  return (
    <WeatherCtx.Provider
      value={{ status, weather, city, useDeviceLocation, lastUpdated, offline, permAsked, requestLocation, selectCity, enableDeviceLocation, disableDeviceLocation, refresh }}
    >
      {children}
    </WeatherCtx.Provider>
  );
}
