import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const HL_COLORS: Record<string, string> = { yellow: "#FEF3C7", green: "#D1FAE5", blue: "#DBEAFE", pink: "#FCE7F3" };

export default function BibleSaved() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"bm" | "notes">("bm");
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    Promise.all([api.bibleBookmarks().catch(() => []), api.bibleNotes().catch(() => [])])
      .then(([b, n]) => { setBookmarks(b || []); setNotes(n || []); })
      .finally(() => setLoading(false));
  }, [user]));

  const open = (r: any) => router.push(`/lettore/read?book=${r.book_nr}&chapter=${r.chapter}&highlight=${r.verse}`);
  const list = tab === "bm" ? bookmarks : notes;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></PressableScale>
        <Text style={styles.title}>Preferiti e note</Text>
        <View style={{ width: 40 }} />
      </View>

      {!user ? (
        <View style={styles.center}><Ionicons name="bookmark-outline" size={40} color={colors.muted} /><Text style={styles.empty}>Accedi per vedere i tuoi preferiti e le note.</Text></View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <>
          <View style={styles.tabs}>
            {([["bm", "Preferiti"], ["notes", "Note"]] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
            {list.length === 0 ? (
              <Text style={styles.empty}>{tab === "bm" ? "Nessun versetto salvato. Tieni premuto su un versetto per evidenziarlo." : "Nessuna nota. Aggiungi una nota da un versetto."}</Text>
            ) : list.map((r) => (
              <PressableScale key={r.id} testID={`saved-${r.id}`} style={styles.row} onPress={() => open(r)}>
                {tab === "bm" && <View style={[styles.dot, { backgroundColor: HL_COLORS[r.color] || HL_COLORS.yellow }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.ref}>{r.book_name} {r.chapter}:{r.verse}</Text>
                  {tab === "bm" ? (
                    <Text style={styles.snippet} numberOfLines={2}>{r.text}</Text>
                  ) : (
                    <Text style={styles.noteText} numberOfLines={3}>{r.note}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </PressableScale>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, textAlign: "center", fontSize: 15, lineHeight: 22 },
  tabs: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center" },
  tabOn: { backgroundColor: colors.navy },
  tabText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  ref: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
  snippet: { color: colors.onSurface, fontSize: 14, lineHeight: 20, marginTop: 3 },
  noteText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: 3, fontStyle: "italic" },
});
