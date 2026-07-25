import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

const CATEGORIES = ["Abbigliamento", "Cappelli", "Tazze", "Accessori", "Libri", "Altro"];
const AVAILABILITY = [
  { key: "available", label: "Disponibile" },
  { key: "coming_soon", label: "Prossimamente" },
  { key: "sold_out", label: "Esaurito" },
];

export default function ProductEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({
    name: "", description: "", long_description: "", category: "Abbigliamento", price: "",
    images: [], colors: "", sizes: "", availability: "available", featured: false, published: true,
  });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) {
      api.adminProduct(id).then((d) => {
        setF({ ...d, colors: (d.colors || []).join(", "), sizes: (d.sizes || []).join(", "), images: d.images || [] });
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const addImages = async () => {
    const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
    let st = cur.status;
    if (st !== "granted" && cur.canAskAgain) st = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (st !== "granted") { setMsg("Permesso galleria negato"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.6, base64: true });
    if (!res.canceled) {
      const newImgs = res.assets.filter((a) => a.base64).map((a) => `data:image/jpeg;base64,${a.base64}`);
      set("images", [...(f.images || []), ...newImgs]);
    }
  };
  const removeImage = (idx: number) => set("images", f.images.filter((_: any, i: number) => i !== idx));

  const payload = () => ({
    name: f.name, description: f.description, long_description: f.long_description,
    category: f.category, price: f.price, images: f.images,
    colors: f.colors ? String(f.colors).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    sizes: f.sizes ? String(f.sizes).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    availability: f.availability, featured: f.featured, published: f.published,
  });

  const save = async () => {
    if (!f.name?.trim()) { setMsg("Il nome è obbligatorio"); return; }
    setBusy(true); setMsg("");
    try {
      if (isNew) { const r = await api.adminCreateProduct(payload()); router.replace(`/admin/products/${r.id}`); }
      else { await api.adminEditProduct(id!, payload()); setMsg("Salvato"); }
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await api.adminDeleteProduct(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="prod-editor-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isNew ? "Nuovo Prodotto" : "Modifica Prodotto"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Images */}
        <Text style={styles.label}>Immagini (una o più)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
          {(f.images || []).map((uri: string, i: number) => (
            <View key={i} style={styles.imgThumb}>
              <Image source={{ uri }} style={styles.imgThumbImg} contentFit="cover" />
              <Pressable testID={`prod-img-remove-${i}`} onPress={() => removeImage(i)} style={styles.imgRemove}><Ionicons name="close" size={14} color={colors.white} /></Pressable>
              {i === 0 && <View style={styles.imgMain}><Text style={styles.imgMainText}>Copertina</Text></View>}
            </View>
          ))}
          <PressableScale testID="prod-add-image" onPress={addImages} style={styles.imgAdd}>
            <Ionicons name="add" size={26} color={colors.brandPrimary} />
            <Text style={styles.imgAddText}>Aggiungi</Text>
          </PressableScale>
        </ScrollView>

        <AInput testID="prod-name" label="Nome *" value={f.name} onChangeText={(v: string) => set("name", v)} />
        <AInput testID="prod-desc" label="Descrizione breve" value={f.description} onChangeText={(v: string) => set("description", v)} multiline />
        <AInput testID="prod-longdesc" label="Descrizione completa" value={f.long_description} onChangeText={(v: string) => set("long_description", v)} multiline />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.pickRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`prod-cat-${c}`} onPress={() => set("category", c)} style={[styles.pick, f.category === c && styles.pickActive]}>
              <Text style={[styles.pickText, f.category === c && styles.pickTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <AInput testID="prod-price" label="Prezzo (opzionale)" value={f.price} onChangeText={(v: string) => set("price", v)} placeholder="Es. €19,90" />
        <AInput testID="prod-colors" label="Colori (separati da virgola)" value={f.colors} onChangeText={(v: string) => set("colors", v)} placeholder="Es. Nero, Bianco, Blu" />
        <AInput testID="prod-sizes" label="Taglie (separate da virgola)" value={f.sizes} onChangeText={(v: string) => set("sizes", v)} placeholder="Es. S, M, L, XL" />

        <Text style={styles.label}>Disponibilità</Text>
        <View style={styles.pickRow}>
          {AVAILABILITY.map((a) => (
            <Pressable key={a.key} testID={`prod-avail-${a.key}`} onPress={() => set("availability", a.key)} style={[styles.pick, f.availability === a.key && styles.pickActive]}>
              <Text style={[styles.pickText, f.availability === a.key && styles.pickTextActive]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ASwitch testID="prod-featured" label="In evidenza" value={f.featured} onValueChange={(v: boolean) => set("featured", v)} />
          <ASwitch testID="prod-published" label="Visibile nell'app" value={f.published} onValueChange={(v: boolean) => set("published", v)} />
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="prod-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>{isNew ? "Crea" : "Salva"}</Text>
        </PressableScale>
        {!isNew && (
          <PressableScale testID="prod-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
            <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.btnText}>Elimina</Text>
          </PressableScale>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: spacing.sm },
  imgThumb: { width: 96, height: 96, borderRadius: radius.md, overflow: "hidden", backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  imgThumbImg: { width: "100%", height: "100%" },
  imgRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  imgMain: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.brandPrimary, paddingVertical: 2, alignItems: "center" },
  imgMainText: { color: colors.white, fontSize: 9, fontWeight: "800" },
  imgAdd: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  imgAddText: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700" },
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  pick: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  pickActive: { backgroundColor: colors.white, borderColor: colors.white },
  pickText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  pickTextActive: { color: colors.navy, fontWeight: "800" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});
