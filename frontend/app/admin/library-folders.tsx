import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { confirmAsync } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const ICONS = ["microphone", "book-open-variant", "book-open-page-variant", "bullhorn", "play-circle", "radio", "star", "heart", "bookmark", "folder", "music", "video"];

export default function AdminLibraryFolders() {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("folder");

  const load = useCallback(() => {
    api.adminLibraryFolders().then(setFolders).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!newName.trim()) return;
    await api.adminCreateFolder({ name: newName.trim(), icon: newIcon }).catch(() => {});
    setNewName(""); setNewIcon("folder"); load();
  };
  const rename = async (f: any, name: string) => {
    setFolders((p) => p.map((x) => (x.id === f.id ? { ...x, name } : x)));
  };
  const saveName = async (f: any) => { await api.adminUpdateFolder(f.id, { name: f.name }).catch(() => {}); };
  const setIcon = async (f: any, icon: string) => {
    setFolders((p) => p.map((x) => (x.id === f.id ? { ...x, icon } : x)));
    await api.adminUpdateFolder(f.id, { icon }).catch(() => {});
  };
  const remove = async (f: any) => {
    const ok = await confirmAsync("Eliminare la cartella?", `"${f.name}" verrà rimossa. I contenuti non verranno cancellati.`, "Elimina", true);
    if (!ok) return;
    await api.adminDeleteFolder(f.id).catch(() => {}); load();
  };
  const move = async (idx: number, dir: number) => {
    const arr = [...folders];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setFolders(arr);
    await Promise.all(arr.map((f, i) => api.adminUpdateFolder(f.id, { order: i }).catch(() => {})));
  };

  return (
    <AdminShell title="Cartelle Biblioteca" activeKey="library_folders">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Crea e organizza le cartelle della Biblioteca. I preferiti degli utenti finiranno nella cartella assegnata a ciascun contenuto (schermata "Assegna contenuti").</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nuova cartella</Text>
            <AInput testID="new-folder-name" label="Nome" value={newName} onChangeText={setNewName} placeholder="Es. Testimonianze" />
            <Text style={styles.fieldLabel}>Icona</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => setNewIcon(ic)} style={[styles.iconChip, newIcon === ic && styles.iconChipActive]}>
                  <MaterialCommunityIcons name={ic as any} size={22} color={newIcon === ic ? colors.white : ADMIN.muted} />
                </Pressable>
              ))}
            </ScrollView>
            <PressableScale testID="create-folder" style={styles.addBtn} onPress={create}>
              <Ionicons name="add" size={18} color={colors.white} /><Text style={styles.addBtnText}>Crea cartella</Text>
            </PressableScale>
          </View>

          {folders.map((f, idx) => (
            <View key={f.id} style={styles.card}>
              <View style={styles.folderHead}>
                <View style={styles.folderIcon}><MaterialCommunityIcons name={(f.icon || "folder") as any} size={22} color={colors.white} /></View>
                <View style={styles.moveCol}>
                  <Pressable onPress={() => move(idx, -1)} hitSlop={8}><Ionicons name="chevron-up" size={20} color={ADMIN.muted} /></Pressable>
                  <Pressable onPress={() => move(idx, 1)} hitSlop={8}><Ionicons name="chevron-down" size={20} color={ADMIN.muted} /></Pressable>
                </View>
                <Pressable testID={`delete-folder-${f.id}`} onPress={() => remove(f)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.error} /></Pressable>
              </View>
              <AInput testID={`folder-name-${f.id}`} label="Nome" value={f.name} onChangeText={(v: string) => rename(f, v)} />
              <PressableScale testID={`save-folder-${f.id}`} style={styles.saveNameBtn} onPress={() => saveName(f)}>
                <Ionicons name="checkmark" size={15} color={colors.white} /><Text style={styles.saveNameText}>Salva nome</Text>
              </PressableScale>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
                {ICONS.map((ic) => (
                  <Pressable key={ic} onPress={() => setIcon(f, ic)} style={[styles.iconChip, f.icon === ic && styles.iconChipActive]}>
                    <MaterialCommunityIcons name={ic as any} size={20} color={f.icon === ic ? colors.white : ADMIN.muted} />
                  </Pressable>
                ))}
              </ScrollView>
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
  fieldLabel: { color: ADMIN.muted, fontSize: 12.5, fontWeight: "700", marginTop: spacing.sm, marginBottom: 6 },
  iconRow: { gap: 8, paddingVertical: 4 },
  iconChip: { width: 42, height: 42, borderRadius: 12, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN.border },
  iconChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.md },
  addBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  folderHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  folderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  moveCol: { flex: 1, flexDirection: "row", gap: spacing.md },
  saveNameBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: colors.navy, paddingVertical: 8, borderRadius: radius.pill, alignSelf: "flex-start", paddingHorizontal: 14, marginBottom: spacing.sm },
  saveNameText: { color: colors.white, fontSize: 12.5, fontWeight: "700" },
});
