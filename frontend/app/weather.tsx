import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWeather } from "@/src/weather/WeatherContext";
import { weatherVisual } from "@/src/weather/weatherCodes";
import { cityLocalTime, isDaytime } from "@/src/weather/weatherApi";
import { colors, spacing, radius } from "@/src/theme";

const hhmm = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : "—");
const dayName = (iso: string, i: number) => {
  if (i === 0) return "Oggi";
  try { return new Date(iso).toLocaleDateString("it-IT", { weekday: "short" }); } catch { return ""; }
};

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { weather, city, status, offline, lastUpdated, refresh } = useWeather();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable testID="weather-back" onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color={colors.white} /></Pressable>
      <Text style={styles.headerTitle}>Meteo</Text>
      <View style={{ width: 26 }} />
    </View>
  );

  if (!weather) {
    return (
      <View style={styles.screen}>
        {Header}
        <View style={styles.center}>
          {status === "loading" ? <ActivityIndicator color={colors.brandSecondary} size="large" /> : <Text style={styles.dim}>Informazioni meteo non disponibili al momento.</Text>}
        </View>
      </View>
    );
  }

  const vis = weatherVisual(weather.code, isDaytime(weather));
  const details = [
    { icon: "thermometer", label: "Percepita", value: `${weather.feelsLike}°` },
    { icon: "water-percent", label: "Umidità", value: `${weather.humidity}%` },
    { icon: "weather-windy", label: "Vento", value: `${weather.windSpeed} km/h` },
    { icon: "gauge", label: "Pressione", value: `${weather.pressure} hPa` },
    { icon: "eye", label: "Visibilità", value: `${(weather.visibility / 1000).toFixed(1)} km` },
    { icon: "weather-sunset-up", label: "Alba", value: hhmm(weather.sunrise) },
    { icon: "weather-sunset-down", label: "Tramonto", value: hhmm(weather.sunset) },
    { icon: "clock-outline", label: "Ora locale", value: cityLocalTime(weather.utcOffsetSeconds) },
  ];

  return (
    <View style={styles.screen}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandSecondary} />}>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View style={styles.cityRow}>
            <Ionicons name="location-sharp" size={15} color={colors.brandSecondary} />
            <Text style={styles.city}>{city?.name}{city?.country ? `, ${city.country}` : ""}</Text>
          </View>
          <MaterialCommunityIcons name={vis.icon as any} size={96} color={colors.white} style={{ marginVertical: spacing.sm }} />
          <Text style={styles.bigTemp}>{weather.temp}°</Text>
          <Text style={styles.bigDesc}>{vis.label}</Text>
          <Text style={styles.bigMinMax}>Min {weather.min}° • Max {weather.max}°</Text>
          {offline && lastUpdated && (
            <Text style={styles.offline}>Ultimo aggiornamento alle {new Date(lastUpdated).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</Text>
          )}
        </Animated.View>

        <View style={styles.grid}>
          {details.map((d, i) => (
            <Animated.View key={d.label} entering={FadeInDown.delay(80 + i * 40)} style={styles.detailCard}>
              <MaterialCommunityIcons name={d.icon as any} size={22} color={colors.brandSecondary} />
              <Text style={styles.detailValue}>{d.value}</Text>
              <Text style={styles.detailLabel}>{d.label}</Text>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.section}>Prossimi 5 giorni</Text>
        <View style={styles.forecast}>
          {weather.daily.slice(0, 5).map((d, i) => {
            const v = weatherVisual(d.code, true);
            return (
              <View key={d.date} style={styles.fRow}>
                <Text style={styles.fDay}>{dayName(d.date, i)}</Text>
                <MaterialCommunityIcons name={v.icon as any} size={26} color={colors.brandSecondary} />
                <Text style={styles.fDesc} numberOfLines={1}>{v.label}</Text>
                <Text style={styles.fTemp}>{d.min}° / <Text style={styles.fMax}>{d.max}°</Text></Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  dim: { color: colors.muted, fontSize: 15, textAlign: "center" },
  hero: { alignItems: "center", paddingVertical: spacing.lg },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  city: { color: colors.brandSecondary, fontSize: 15, fontWeight: "700" },
  bigTemp: { color: colors.white, fontSize: 72, fontWeight: "800", letterSpacing: -2 },
  bigDesc: { color: "rgba(255,255,255,0.85)", fontSize: 18, fontWeight: "600", marginTop: -spacing.sm },
  bigMinMax: { color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: spacing.sm },
  offline: { color: colors.warning, fontSize: 12, marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  detailCard: { width: "47%", flexGrow: 1, backgroundColor: colors.navySoft, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", gap: 6 },
  detailValue: { color: colors.white, fontSize: 20, fontWeight: "800" },
  detailLabel: { color: colors.muted, fontSize: 12 },
  section: { color: colors.white, fontSize: 17, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  forecast: { backgroundColor: colors.navySoft, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  fRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  fDay: { color: colors.white, fontSize: 15, fontWeight: "700", width: 54, textTransform: "capitalize" },
  fDesc: { color: colors.muted, fontSize: 13, flex: 1 },
  fTemp: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  fMax: { color: colors.white },
});
