import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWeather } from "@/src/weather/WeatherContext";
import { weatherVisual } from "@/src/weather/weatherCodes";
import CitySearchModal from "@/src/components/CitySearchModal";
import { colors, spacing, radius } from "@/src/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { weather, city, useDeviceLocation, enableDeviceLocation, disableDeviceLocation, selectCity, refresh } = useWeather();
  const [pickCity, setPickCity] = useState(false);

  const onToggleGps = async (v: boolean) => {
    if (v) await enableDeviceLocation();
    else disableDeviceLocation();
  };

  const vis = weather ? weatherVisual(weather.code, weather.isDay) : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={styles.section}>Meteo</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="location" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Usa posizione del dispositivo</Text>
                <Text style={styles.rowSub}>Rileva automaticamente la tua città</Text>
              </View>
            </View>
            <Switch testID="settings-gps" value={useDeviceLocation} onValueChange={onToggleGps} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor={colors.white} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              {vis ? <MaterialCommunityIcons name={vis.icon as any} size={22} color={colors.brandPrimary} /> : <Ionicons name="business" size={20} color={colors.brandPrimary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Città selezionata</Text>
                <Text style={styles.rowSub}>{city?.name || "Nessuna"}{weather ? ` · ${weather.temp}°` : ""}</Text>
              </View>
            </View>
            <Pressable testID="settings-change-city" onPress={() => setPickCity(true)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Cambia</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable testID="settings-refresh" style={styles.row} onPress={() => refresh()}>
            <View style={styles.rowLeft}>
              <Ionicons name="refresh" size={20} color={colors.brandPrimary} />
              <Text style={styles.rowTitle}>Aggiorna meteo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <Text style={styles.note}>La posizione viene usata solo per mostrare il meteo locale. Nessuno storico di posizione viene salvato.</Text>
      </ScrollView>

      <CitySearchModal visible={pickCity} onClose={() => setPickCity(false)} onSelect={selectCity} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  section: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg },
  smallBtn: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  smallBtnText: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: 13 },
  note: { color: colors.muted, fontSize: 12, marginTop: spacing.md, lineHeight: 17, paddingHorizontal: spacing.xs },
});
