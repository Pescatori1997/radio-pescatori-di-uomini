import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { api, mediaUrl, uploadMediaChunked } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { alertMessage } from "@/src/utils/confirm";
import {
  NAV_CATALOG, DEFAULT_NAV, resolveNavItem, VectorIcon, NavAsset, NavItemConfig,
} from "@/src/components/navConfig";
import NavAnim from "@/src/components/nav/NavAnim";
import { colors, spacing, radius } from "@/src/theme";

const CATALOG_MAP = Object.fromEntries(NAV_CATALOG.map((i) => [i.key, i]));
const SWATCHES = ["#0A1128", "#0EA5E9", "#38BDF8", "#E0B15E", "#0F766E", "#FFFFFF", "#94A3B8"];

function detectKind(filename?: string, mime?: string): "lottie" | "raster" {
  const f = (filename || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (f.endsWith(".json") || f.endsWith(".lottie") || m.includes("json")) return "lottie";
  return "raster";
}

/** Small color picker: preset nautical swatches + hex input. */
function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.swatchRow}>
        {SWATCHES.map((c) => (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }, (value || "").toLowerCase() === c.toLowerCase() && styles.swatchActive]} />
        ))}
        <Pressable onPress={() => onChange("")} style={[styles.swatch, styles.swatchReset]}>
          <Ionicons name="refresh" size={14} color={ADMIN.muted} />
        </Pressable>
      </View>
      <AInput testID={`color-${label}`} label="" value={value || ""} onChangeText={onChange} placeholder="#0EA5E9 (vuoto = predefinito)" autoCapitalize="none" />
    </View>
  );
}

/** Live preview of an uploaded asset (image or Lottie), with a replay button. */
function AssetPreview({ asset, size = 40 }: { asset: NavAsset; size?: number }) {
  const [token, setToken] = useState(1);
  const [broken, setBroken] = useState(false);
  if (!asset || !asset.id) return <View style={[styles.previewBox, { width: size, height: size }]}><Ionicons name="image-outline" size={18} color={ADMIN.muted} /></View>;
  const url = mediaUrl(asset.id);
  if (broken) return <View style={[styles.previewBox, { width: size, height: size }]}><Ionicons name="warning-outline" size={16} color={colors.error} /></View>;
  return (
    <Pressable onPress={() => setToken((t) => t + 1)} style={[styles.previewBox, { width: size, height: size }]}>
      {asset.kind === "lottie" || asset.kind === "raster" ? (
        (asset.kind === "lottie" || (asset.mime || "").includes("gif") || (asset.filename || "").toLowerCase().endsWith(".gif") || (asset.mime || "").includes("webp")) ? (
          <NavAnim url={url} kind={asset.kind} size={size - 6} playToken={token} onError={() => setBroken(true)} />
        ) : (
          <Image source={{ uri: url }} style={{ width: size - 6, height: size - 6 }} contentFit="contain" onError={() => setBroken(true)} />
        )
      ) : (
        <Image source={{ uri: url }} style={{ width: size - 6, height: size - 6 }} contentFit="contain" onError={() => setBroken(true)} />
      )}
    </Pressable>
  );
}

/** Upload / replace / remove one nav asset (image or Lottie/GIF/WebP animation). */
function NavAssetField({ label, hint, asset, onChange }: { label: string; hint?: string; asset: NavAsset; onChange: (a: NavAsset) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const control = useRef<{ cancelled?: boolean }>({});

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/json"], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const webBlob = Platform.OS === "web" ? ((a as any).file as Blob | undefined) : undefined;
      control.current = { cancelled: false };
      setPct(0);
      const info = await uploadMediaChunked(
        { uri: a.uri, name: a.name || "icon", mime: a.mimeType || "application/octet-stream", blob: webBlob },
        (p) => setPct(p),
        control.current,
      );
      setPct(null);
      onChange({ id: info.media_id, kind: detectKind(a.name, info.media_mime || a.mimeType), mime: info.media_mime || a.mimeType, filename: a.name });
    } catch (e: any) {
      setPct(null);
      if (e?.message !== "Caricamento annullato") alertMessage("Errore di caricamento", e?.message || "Riprova.");
    }
  };

  return (
    <View style={styles.assetRow}>
      <AssetPreview asset={asset} />
      <View style={{ flex: 1 }}>
        <Text style={styles.assetLabel}>{label}</Text>
        {!!hint && <Text style={styles.assetHint}>{hint}</Text>}
        {pct !== null ? (
          <Text style={styles.assetProgress}>Caricamento… {Math.round(pct * 100)}%</Text>
        ) : (
          <View style={styles.assetBtns}>
            <Pressable onPress={pick} style={styles.assetBtn}><Ionicons name="cloud-upload-outline" size={15} color={colors.white} /><Text style={styles.assetBtnText}>{asset?.id ? "Sostituisci" : "Carica"}</Text></Pressable>
            {!!asset?.id && <Pressable onPress={() => onChange(null)} style={[styles.assetBtn, styles.assetBtnGhost]}><Ionicons name="trash-outline" size={15} color={colors.error} /><Text style={[styles.assetBtnText, { color: colors.error }]}>Rimuovi</Text></Pressable>}
          </View>
        )}
      </View>
    </View>
  );
}

/** One icon slot rendered exactly like the app bar (for the whole-bar preview). */
function PreviewCell({ cfgKey, cfg, focused, onPress }: { cfgKey: string; cfg?: NavItemConfig; focused: boolean; onPress: () => void }) {
  const base = CATALOG_MAP[cfgKey];
  if (!base) return null;
  const item = resolveNavItem(base, cfg);
  const colorInactive = item.colorInactive || colors.muted;
  const colorActive = item.colorActive || colors.brandPrimary;
  const size = 24;
  const [token, setToken] = useState(0);
  const handle = () => { if (item.animUrl) setToken((t) => t + 1); onPress(); };
  let icon: React.ReactNode;
  if (focused) {
    if (item.animUrl) icon = <NavAnim url={item.animUrl} kind={item.animKind} size={size + 2} playToken={token || 1} />;
    else if (item.iconActiveUrl) icon = <Image source={{ uri: item.iconActiveUrl }} style={{ width: size, height: size }} contentFit="contain" />;
    else icon = <VectorIcon family={item.family} name={item.iconOn} size={size} color={colorActive} />;
  } else {
    if (item.iconUrl) icon = <Image source={{ uri: item.iconUrl }} style={{ width: size, height: size }} contentFit="contain" />;
    else icon = <VectorIcon family={item.family} name={item.icon} size={size} color={colorInactive} />;
  }
  return (
    <Pressable onPress={handle} style={styles.pvItem}>
      {focused && item.indicator ? <View style={[styles.pvDot, { backgroundColor: colorActive }]} /> : null}
      <View style={[styles.pvIconWrap, focused && { backgroundColor: colorActive + "1F" }]}>{icon}</View>
      <Text numberOfLines={1} style={[styles.pvLabel, { color: focused ? colors.navy : colorInactive, fontWeight: focused ? "800" : "600" }]}>{item.label}</Text>
    </Pressable>
  );
}

export default function AdminNavIcons() {
  const { refresh } = useSettings();
  const [navItems, setNavItems] = useState<string[]>([]);
  const [cfg, setCfg] = useState<Record<string, NavItemConfig>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewIdx, setPreviewIdx] = useState(0);

  const load = useCallback(() => {
    api.adminSettings().then((d) => {
      const items = Array.isArray(d.nav_items) && d.nav_items.length ? d.nav_items.filter((k: string) => CATALOG_MAP[k]) : [...DEFAULT_NAV];
      setNavItems(items);
      setCfg(d.nav_config || {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setItem = (key: string, patch: Partial<NavItemConfig>) =>
    setCfg((p) => ({ ...p, [key]: { ...(p[key] || {}), ...patch } }));

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminUpdateSettings({ nav_config: cfg }); refresh(); setMsg("Personalizzazione salvata ✓ Le modifiche sono già attive nell'app."); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Personalizzazione Navigazione" activeKey="nav_icons">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Personalizza ogni voce della barra in basso: nome, colori, indicatore, icone (PNG/WebP) e un'animazione opzionale (Lottie .json, GIF o WebP animato). L'animazione viene riprodotta una volta quando si seleziona la sezione. Se un file è errato, l'app usa automaticamente l'icona predefinita. Le modifiche sono attive subito, senza nuovo deploy.
          </Text>

          {/* Whole-bar live preview */}
          <Text style={styles.section}>Anteprima barra</Text>
          <View style={styles.barPreview}>
            {navItems.map((k, i) => (
              <PreviewCell key={k} cfgKey={k} cfg={cfg[k]} focused={previewIdx === i} onPress={() => setPreviewIdx(i)} />
            ))}
          </View>
          <Text style={styles.previewHint}>Tocca una voce per vedere lo stato attivo e l'animazione.</Text>

          {navItems.length === 0 && <Text style={styles.intro}>Nessuna voce nella barra. Aggiungi le sezioni da Impostazioni → Barra di navigazione.</Text>}

          {navItems.map((key) => {
            const base = CATALOG_MAP[key];
            if (!base) return null;
            const c = cfg[key] || {};
            return (
              <View key={key} style={styles.card}>
                <View style={styles.cardHead}>
                  <VectorIcon family={base.family} name={base.iconOn} size={20} color={colors.brandPrimary} />
                  <Text style={styles.cardTitle}>{base.label}</Text>
                </View>

                <AInput testID={`label-${key}`} label="Nome visualizzato" value={c.label ?? ""} onChangeText={(v: string) => setItem(key, { label: v })} placeholder={base.label} />

                <ColorField label="Colore icona (normale)" value={c.color} onChange={(v) => setItem(key, { color: v })} />
                <ColorField label="Colore icona (attiva)" value={c.colorActive} onChange={(v) => setItem(key, { colorActive: v })} />

                <ASwitch testID={`indicator-${key}`} label="Onda / indicatore sotto l'icona attiva" value={c.indicator !== false} onValueChange={(v: boolean) => setItem(key, { indicator: v })} />

                <NavAssetField label="Icona normale" hint="PNG / WebP" asset={c.icon || null} onChange={(a) => setItem(key, { icon: a })} />
                <NavAssetField label="Icona attiva" hint="PNG / WebP" asset={c.iconActive || null} onChange={(a) => setItem(key, { iconActive: a })} />
                <NavAssetField label="Animazione (opzionale)" hint="Lottie .json · GIF · WebP animato" asset={c.anim || null} onChange={(a) => setItem(key, { anim: a })} />
              </View>
            );
          })}

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <PressableScale testID="nav-icons-save" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.saveText}>Salva</Text>
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  section: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.sm, marginBottom: spacing.sm },
  barPreview: { flexDirection: "row", backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, paddingVertical: 8, paddingHorizontal: 4, justifyContent: "space-around" },
  previewHint: { color: ADMIN.muted, fontSize: 12, marginTop: 6, marginBottom: spacing.md, textAlign: "center" },
  pvItem: { flex: 1, alignItems: "center" },
  pvDot: { position: "absolute", top: 0, width: 18, height: 3, borderRadius: 2 },
  pvIconWrap: { width: 46, height: 30, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4, marginBottom: 2 },
  pvLabel: { fontSize: 10, textAlign: "center" },
  card: { backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  fieldLabel: { color: ADMIN.muted, fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  swatchRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  swatch: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: ADMIN.border },
  swatchActive: { borderWidth: 3, borderColor: colors.brandSecondary },
  swatchReset: { backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center" },
  assetRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  assetLabel: { color: colors.white, fontSize: 14, fontWeight: "700" },
  assetHint: { color: ADMIN.muted, fontSize: 11.5, marginTop: 1 },
  assetProgress: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: 6 },
  assetBtns: { flexDirection: "row", gap: spacing.sm, marginTop: 8 },
  assetBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandPrimary, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill },
  assetBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.error },
  assetBtnText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  previewBox: { borderRadius: 10, backgroundColor: ADMIN.surface, borderWidth: 1, borderColor: ADMIN.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});
