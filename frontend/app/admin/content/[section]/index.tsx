import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { SECTION_LABEL } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

const FILTERS = [{ k: "", l: "Tutti" }, { k: "published", l: "Pubblicati" }, { k: "draft", l: "Bozze" }, { k: "archived", l: "Archiviati" }];
const STATUS_COLOR: Record<string, string> = { published: colors.success, draft: colors.warning, archived: colors.muted };
const TYPE_ICON: Record<string, any> = { video: "video", audio: "music", pdf: "file-pdf-box", image: "image", embed: "web" };

export default function ContentList() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.adminContents(section!, { status: filter || undefined }).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [section, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const label = SECTION_LABEL[section!] || "Contenuti";

  return (
    <AdminShell title={label} activeKey={section}>
      <View style={styles.header}>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.k} testID={`cf-${f.k || "all"}`} onPress={() => setFilter(f.k)} style={[styles.chip, filter === f.k && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f.k && styles.chipTextActive]}>{f.l}</Text>
            </Pressable>
          ))}
        </View>
        <PressableScale testID="content-new" style={styles.newBtn} onPress={() => router.push(`/admin/content/${section}/new` as any)}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.newText}>Nuovo</Text>
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="folder-open-outline" size={44} color={ADMIN.muted} />
              <Text style={styles.emptyText}>Nessun contenuto. Tocca "Nuovo" per crearne uno.</Text>
            </View>
          ) : items.map((it) => (
            <Pressable key={it.id} testID={`content-row-${it.id}`} onPress={() => router.push(`/admin/content/${section}/${it.id}` as any)} style={styles.row}>
              <MaterialCommunityIcons name={TYPE_ICON[it.content_type] || "file-document-outline"} size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{it.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{[it.category, it.author, it.duration].filter(Boolean).join(" · ")}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[it.status] || colors.muted }]} />
              <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md, flexWrap: "wrap" },
  filters: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", flex: 1 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  newBtn: { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill },
  newText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: 60 },
  emptyText: { color: ADMIN.muted, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.sm },
  rowTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
