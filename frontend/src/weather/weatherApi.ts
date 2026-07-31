// Weather data layer — Open-Meteo (keyless, CORS-friendly, works on iOS/Android/PWA).

export type CityRef = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type DailyForecast = {
  date: string;
  code: number;
  min: number;
  max: number;
};

export type WeatherData = {
  code: number;
  isDay: boolean;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  visibility: number; // meters
  min: number;
  max: number;
  sunrise: string;
  sunset: string;
  utcOffsetSeconds: number;
  timezone: string;
  daily: DailyForecast[];
};

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

export async function searchCities(query: string): Promise<CityRef[]> {
  const url = `${GEO}?name=${encodeURIComponent(query)}&count=8&language=it&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("geocode");
  const d = await r.json();
  return (d.results || []).map((x: any) => ({
    name: x.name,
    country: x.country,
    admin1: x.admin1,
    latitude: x.latitude,
    longitude: x.longitude,
    timezone: x.timezone,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<CityRef> {
  try {
    const r = await fetch(`${REVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=it`);
    if (r.ok) {
      const d = await r.json();
      const name = d.city || d.locality || d.principalSubdivision || d.countryName || "Posizione attuale";
      return { name, country: d.countryName, admin1: d.principalSubdivision, latitude: lat, longitude: lon };
    }
  } catch {}
  return { name: "Posizione attuale", latitude: lat, longitude: lon };
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,is_day",
    hourly: "visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone: "auto",
    forecast_days: "6",
    wind_speed_unit: "kmh",
  });
  const r = await fetch(`${FORECAST}?${params.toString()}`);
  if (!r.ok) throw new Error("weather");
  const d = await r.json();
  const c = d.current || {};
  const daily = d.daily || {};
  // Current-hour visibility (hourly starts at 00:00 local of today).
  let visibility = 10000;
  try {
    const idx = Math.max(0, (d.utc_offset_seconds != null
      ? new Date(Date.now() + d.utc_offset_seconds * 1000).getUTCHours()
      : new Date().getHours()));
    if (Array.isArray(daily.time) && Array.isArray((d.hourly || {}).visibility)) {
      visibility = d.hourly.visibility[idx] ?? d.hourly.visibility[0] ?? 10000;
    }
  } catch {}

  const days: DailyForecast[] = (daily.time || []).map((t: string, i: number) => ({
    date: t,
    code: daily.weather_code?.[i] ?? 0,
    min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
    max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
  }));

  return {
    code: c.weather_code ?? 0,
    isDay: (c.is_day ?? 1) === 1,
    temp: Math.round(c.temperature_2m ?? 0),
    feelsLike: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0),
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    windSpeed: Math.round(c.wind_speed_10m ?? 0),
    pressure: Math.round(c.surface_pressure ?? 0),
    visibility: Math.round(visibility),
    min: days[0]?.min ?? Math.round(daily.temperature_2m_min?.[0] ?? 0),
    max: days[0]?.max ?? Math.round(daily.temperature_2m_max?.[0] ?? 0),
    sunrise: daily.sunrise?.[0] ?? "",
    sunset: daily.sunset?.[0] ?? "",
    utcOffsetSeconds: d.utc_offset_seconds ?? 0,
    timezone: d.timezone ?? "",
    daily: days,
  };
}

// City local wall-clock time "HH:MM" from an utc offset in seconds.
export function cityLocalTime(utcOffsetSeconds: number): string {
  const cityMs = Date.now() + utcOffsetSeconds * 1000;
  const d = new Date(cityMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Robust day/night decision: compute from the city's current local time vs
 * today's sunrise/sunset instead of trusting the possibly-stale `is_day` flag
 * (which is cached and only refreshed periodically → could show the moon in the
 * morning). Falls back to the API flag when sunrise/sunset are unavailable. */
export function isDaytime(w: { sunrise?: string; sunset?: string; utcOffsetSeconds: number; isDay: boolean }): boolean {
  try {
    if (w.sunrise && w.sunset) {
      const cityMs = Date.now() + (w.utcOffsetSeconds || 0) * 1000;
      const d = new Date(cityMs);
      const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      const toMin = (iso: string) => {
        const t = iso.slice(11, 16); // "HH:MM"
        const [h, m] = t.split(":").map((n) => parseInt(n, 10));
        return h * 60 + m;
      };
      const sr = toMin(w.sunrise);
      const ss = toMin(w.sunset);
      if (!isNaN(sr) && !isNaN(ss)) return nowMin >= sr && nowMin < ss;
    }
  } catch {}
  return w.isDay;
}
