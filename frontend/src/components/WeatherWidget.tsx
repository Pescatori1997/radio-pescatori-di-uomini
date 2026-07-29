import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useWeather } from "@/src/weather/WeatherContext";
import { weatherVisual, weatherCategory } from "@/src/weather/weatherCodes";
import { cityLocalTime } from "@/src/weather/weatherApi";
import CitySearchModal from "@/src/components/CitySearchModal";
import WeatherAnimation from "@/src/components/WeatherAnimation";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function WeatherWidget() {
  const router = useRouter();
  const { status, weather, city, offline, lastUpdated, requestLocation, selectCity } = useWeather();
  const [pickCity, setPickCity] = useState(false);
  const [busy, setBusy] = useState(false);

  const askLocation = async () => { setBusy(true); try { await requestLocation(); } finally { setBusy(false); } };

  if (status === "loading" && !weather) {
    return <View style={[styles.card, styles.centerRow]}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.dim}>Meteo...</Text></View>;
  }

  if (status === "error" && !weather) {
    return (
      <View style={styles.card}>
        <Text style={styles.dim}>Informazioni meteo non disponibili al momento.</Text>
      </View>
    );
  }

  if (status === "need_setup" && !weather) {
    return (
      <>
        <View style={styles.setupCard}>
          <MaterialCommunityIcons name="weather-partly-cloudy" size={28} color={colors.brandPrimary} />
          <Text style={styles.setupTitle}>Meteo locale</Text>
          <Text style={styles.setupSub}>Consenti la posizione per vedere il meteo della tua città, oppure scegli una città.</Text>
          <View style={styles.setupBtns}>
            <PressableScale testID="weather-allow-location" style={styles.primaryBtn} onPress={askLocation} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : <><Ionicons name="location" size={16} color={colors.white} /><Text style={styles.primaryBtnText}>Consenti posizione</Text></>}
            </PressableScale>
            <PressableScale testID="weather-choose-city" style={styles.ghostBtn} onPress={() => setPickCity(true)}>
              <Text style={styles.ghostBtnText}>Scegli città</Text>
            </PressableScale>
          </View>
        </View>
        <CitySearchModal visible={pickCity} onClose={() => setPickCity(false)} onSelect={selectCity} />
      </>
    );
  }

  if (!weather) return null;
  const vis = weatherVisual(weather.code, weather.isDay);
  const cat = weatherCategory(weather.code, weather.isDay);
  const cityName = city?.name || "—";
  const time = cityLocalTime(weather.utcOffsetSeconds);

  return (
    <>
      <Animated.View entering={FadeIn.duration(400)}>
        <PressableScale testID="weather-widget" style={styles.card} onPress={() => router.push("/weather")}>
          <View style={styles.leftIcon}>
            <WeatherAnimation category={cat} size={56} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.cityRow}>
              <Ionicons name="location-sharp" size={13} color={colors.onSurfaceTertiary} />
              <Text style={styles.city} numberOfLines={1}>{cityName}</Text>
            </View>
            <Text style={styles.temp}>{weather.temp}°C</Text>
            <Text style={styles.desc} numberOfLines={1}>{vis.label}</Text>
            <Text style={styles.minmax}>Min {weather.min}° • Max {weather.max}°</Text>
          </View>
          <View style={styles.right}>
            <View style={styles.timeChip}><Ionicons name="time-outline" size={13} color={colors.onSurfaceTertiary} /><Text style={styles.time}>{time}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
        </PressableScale>
        {offline && lastUpdated && (
          <Text style={styles.offline}>Ultimo aggiornamento alle {new Date(lastUpdated).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</Text>
        )}
      </Animated.View>
      <CitySearchModal visible={pickCity} onClose={() => setPickCity(false)} onSelect={selectCity} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  centerRow: { justifyContent: "center", gap: spacing.sm },
  dim: { color: colors.onSurfaceSecondary, fontSize: 14 },
  leftIcon: { width: 56, alignItems: "center", justifyContent: "center" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  city: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "700", flex: 1 },
  temp: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600", marginTop: 1 },
  minmax: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 },
  right: { alignItems: "flex-end", justifyContent: "space-between", alignSelf: "stretch" },
  timeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  time: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  offline: { color: colors.muted, fontSize: 11, marginTop: 6, marginLeft: 4 },
  setupCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
  setupTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: spacing.sm },
  setupSub: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  setupBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  ghostBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  ghostBtnText: { color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 14 },
});
