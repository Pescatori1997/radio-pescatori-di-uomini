import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

const TYPE_LABELS: Record<string, string> = {
  podcast: "Podcast", meditazioni: "Meditazioni", "studi-biblici": "Studi Biblici",
  predicazioni: "Predicazioni", video: "Video", programma: "Programmi",
};

export default function AdminContentFolders() {
  const [catalog, setCatalog] = useState<Record<string, any[]>>({});
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([api.adminContentCatalog(), api.adminLibraryFolders()])
      .then(([c, f]: any[]) => { setCatalog(c || {}); setFolders(f || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assign = async (type: string, itemId: string, folderId: string | null) => {
    // toggle off if tapping the already-selected folder
    const cur = catalog[type]?.find((x) => x.id === itemId)?.folder_id;
    const next = cur === folderId ? null : folderId;
    setCatalog((p) => ({ ...p, [type]: p[type].map((x) => (x.id === itemId ? { ...x, folder_id: next } : x)) }));
    await api.adminSetContentFolder({ item_type: type, item_id: itemId, folder_id: next }).catch(() => {});
  };

  const types = Object.keys(catalog).filter((t) => (catalog[t] || []).length > 0);

  return (
    <AdminShell title="Assegna contenuti" activeKey="content_folders">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
          <Text style={styles.intro}>Scegli in quale cartella della Biblioteca appare ogni contenuto quando un utente lo mette tra i preferiti. Se non assegni nulla, il contenuto va nella cartella predefinita per il suo tipo.</Text>

          {folders.length === 0 && <Text style={styles.intro}>Crea prima delle cartelle da "Cartelle Biblioteca".</Text>}

          {types.map((type) => (
            <View key={type} style={styles.card}>
              <Text style={styles.cardTitle}>{TYPE_LABELS[type] || type}</Text>
              {(catalog[type] || []).map((it) => (
                <View key={it.id} style={styles.item}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{it.title}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {folders.map((f) => {
                      const active = it.folder_id === f.id;
                      return (
                        <Pressable key={f.id} testID={`assign-${it.id}-${f.id}`} onPress={() => assign(type, it.id, f.id)}
                          style={[styles.chip, active && styles.chipActive]}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.name}</Text>
                          {active && <Ionicons name="checkmark" size={13} color={colors.white} />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  card: { backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  item: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: ADMIN.border },
  itemTitle: { color: colors.white, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ADMIN.card, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 12.5, fontWeight: "700" },
  chipTextActive: { color: colors.white },
});
