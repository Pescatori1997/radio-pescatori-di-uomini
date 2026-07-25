import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchCities, CityRef } from "@/src/weather/weatherApi";
import { colors, spacing, radius } from "@/src/theme";

export default function CitySearchModal({
  visible, onClose, onSelect,
}: { visible: boolean; onClose: () => void; onSelect: (c: CityRef) => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CityRef[]>([]);
  const [loading, setLoading] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    if (q.trim().length < 2) { setResults([]); return; }
    deb.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchCities(q.trim())); } catch { setResults([]); } finally { setLoading(false); }
    }, 350);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [q]);

  useEffect(() => { if (!visible) { setQ(""); setResults([]); } }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="city-close" onPress={onClose} hitSlop={10}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
          <Text style={styles.title}>Scegli la tua città</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="city-input" value={q} onChangeText={setQ} placeholder="Cerca una città nel mondo..." placeholderTextColor={colors.muted} style={styles.input} autoFocus />
          {loading && <ActivityIndicator size="small" color={colors.brandPrimary} />}
        </View>
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.latitude},${item.longitude},${i}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable testID={`city-result-${item.name}`} style={styles.row} onPress={() => { onSelect(item); onClose(); }}>
              <Ionicons name="location-outline" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cityName}>{item.name}</Text>
                <Text style={styles.citySub}>{[item.admin1, item.country].filter(Boolean).join(", ")}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={q.trim().length >= 2 && !loading ? <Text style={styles.empty}>Nessun risultato</Text> : null}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, marginHorizontal: spacing.lg },
  input: { flex: 1, color: colors.onSurface, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cityName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  citySub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 1 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl },
});
