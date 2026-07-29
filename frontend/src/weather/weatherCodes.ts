// WMO weather code -> icon (MaterialCommunityIcons) + Italian label. Day/night aware.
export type WeatherVisual = { icon: string; label: string };

export function weatherVisual(code: number, isDay: boolean = true): WeatherVisual {
  const map: Record<number, WeatherVisual> = {
    0: { icon: isDay ? "weather-sunny" : "weather-night", label: "Sereno" },
    1: { icon: isDay ? "weather-partly-cloudy" : "weather-night-partly-cloudy", label: "Prevalentemente sereno" },
    2: { icon: isDay ? "weather-partly-cloudy" : "weather-night-partly-cloudy", label: "Parzialmente nuvoloso" },
    3: { icon: "weather-cloudy", label: "Nuvoloso" },
    45: { icon: "weather-fog", label: "Nebbia" },
    48: { icon: "weather-fog", label: "Nebbia" },
    51: { icon: "weather-partly-rainy", label: "Pioggerella leggera" },
    53: { icon: "weather-partly-rainy", label: "Pioggerella" },
    55: { icon: "weather-rainy", label: "Pioggerella intensa" },
    56: { icon: "weather-snowy-rainy", label: "Pioggia gelata" },
    57: { icon: "weather-snowy-rainy", label: "Pioggia gelata" },
    61: { icon: "weather-partly-rainy", label: "Pioggia leggera" },
    63: { icon: "weather-rainy", label: "Pioggia" },
    65: { icon: "weather-pouring", label: "Pioggia intensa" },
    66: { icon: "weather-snowy-rainy", label: "Pioggia gelata" },
    67: { icon: "weather-snowy-rainy", label: "Pioggia gelata intensa" },
    71: { icon: "weather-snowy", label: "Neve leggera" },
    73: { icon: "weather-snowy", label: "Neve" },
    75: { icon: "weather-snowy-heavy", label: "Neve intensa" },
    77: { icon: "weather-snowy", label: "Granelli di neve" },
    80: { icon: "weather-partly-rainy", label: "Rovesci leggeri" },
    81: { icon: "weather-rainy", label: "Rovesci" },
    82: { icon: "weather-pouring", label: "Rovesci violenti" },
    85: { icon: "weather-snowy", label: "Rovesci di neve" },
    86: { icon: "weather-snowy-heavy", label: "Rovesci di neve intensi" },
    95: { icon: "weather-lightning", label: "Temporale" },
    96: { icon: "weather-lightning-rainy", label: "Temporale con grandine" },
    99: { icon: "weather-lightning-rainy", label: "Temporale con grandine" },
  };
  return map[code] || { icon: "weather-cloudy", label: "—" };
}

export type WeatherCategory = "sun" | "moon" | "cloud" | "rain" | "thunder" | "snow" | "fog";

/** Map a WMO code (+ day/night) to a broad category used to pick the animated illustration. */
export function weatherCategory(code: number, isDay: boolean = true): WeatherCategory {
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "thunder";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 0 || code === 1) return isDay ? "sun" : "moon";
  // 2, 3 and anything else → clouds
  return "cloud";
}
