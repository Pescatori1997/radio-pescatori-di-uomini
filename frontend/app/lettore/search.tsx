import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function BibleSearch() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (q.trim().length < 2) return;
    setLoading(true); setSearched(true);
    try { const d = await api.bibleSearch(q.trim()); setResults(d.results || []); }
    catch { setResults([]); }
    finally { setLoading(false); }
  };

  const highlight = (text: string) => {
    const term = q.trim();
    if (!term) return <Text style={styles.rText}>{text}</Text>;
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
    return (
      <Text style={styles.rText}>
        {parts.map((p, i) => p.toLowerCase() === term.toLowerCase() ? <Text key={i} style={styles.mark}>{p}</Text> : p)}
      </Text>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></PressableScale>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="bible-search-input" value={q} onChangeText={setQ} onSubmitEditing={run} returnKeyType="search"
            autoFocus placeholder="Cerca una parola o frase..." placeholderTextColor={colors.muted} style={styles.input} />
          {q ? <PressableScale onPress={() => { setQ(""); setResults([]); setSearched(false); }}><Ionicons name="close-circle" size={18} color={colors.muted} /></PressableScale> : null}
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {searched && results.length === 0 ? (
            <Text style={styles.empty}>Nessun risultato per “{q}”.</Text>
          ) : (
            <>
              {results.length > 0 && <Text style={styles.count}>{results.length} risultati</Text>}
              {results.map((r, i) => (
                <PressableScale key={i} testID={`bible-result-${i}`} style={styles.row}
                  onPress={() => router.push(`/lettore/read?book=${r.book_nr}&chapter=${r.chapter}&highlight=${r.verse}`)}>
                  <Text style={styles.ref}>{r.book_name} {r.chapter}:{r.verse}</Text>
                  {highlight(r.text)}
                </PressableScale>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.onSurface, fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: spacing.md },
  row: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  ref: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", marginBottom: 4 },
  rText: { color: colors.onSurface, fontSize: 14.5, lineHeight: 21 },
  mark: { backgroundColor: colors.brandSecondary + "55", color: colors.navy, fontWeight: "800" },
});
