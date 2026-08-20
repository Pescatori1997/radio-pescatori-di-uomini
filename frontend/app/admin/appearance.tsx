import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { PALETTES, DEFAULT_PALETTE_KEY, resolvePalette } from "@/src/palettes";
import { applyPalette, cachePaletteKey } from "@/src/appearance";
import { useSiteText } from "@/src/context/SiteTextsContext";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminAppearance() {
  const { refresh } = useSiteText();
  const [selected, setSelected] = useState<string>(DEFAULT_PALETTE_KEY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d: any = await api.siteSettings();
      const key = d?.appearance?.palette;
      setSelected(typeof key === "string" && key ? key : DEFAULT_PALETTE_KEY);
    } catch {
      setSelected(DEFAULT_PALETTE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true);
    try {
      await api.adminUpdateSiteSettings({ appearance: { palette: selected } });
      await cachePaletteKey(selected);
      applyPalette(resolvePalette(selected)); // live mutate for newly-mounted screens
      refresh();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Reload so every screen picks up the new accent instantly.
        window.location.reload();
        return;
      }
      alertMessage("Salvato ✓", "Colore applicato. Riapri l'app per vederlo ovunque.");
    } catch (e: any) {
      alertMessage("Errore", e?.message || "Impossibile salvare.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title="Aspetto" activeKey="site">
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Aspetto" activeKey="site">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Scegli il <Text style={styles.b}>colore principale</Text> dell'app. Verrà applicato a pulsanti, tab attive, badge, icone e gradienti chiave. Sfondi, testi e struttura restano invariati.
        </Text>

        <View style={styles.grid}>
          {PALETTES.map((p) => {
            const active = p.key === selected;
            return (
              <PressableScale
                key={p.key}
                testID={`palette-${p.key}`}
                onPress={() => setSelected(p.key)}
                style={[styles.card, active && { borderColor: p.brandPrimary, borderWidth: 2 }]}
              >
                <View style={styles.swatches}>
                  <View style={[styles.swatch, { backgroundColor: p.brandPrimary }]} />
                  <View style={[styles.swatch, { backgroundColor: p.brandSecondary }]} />
                  <View style={[styles.swatch, styles.swatchSm, { backgroundColor: p.brandTertiary }]} />
                </View>
                <View style={styles.cardFoot}>
                  <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={p.brandPrimary} />}
                </View>
              </PressableScale>
            );
          })}
        </View>

        {/* Live preview of the picked accent */}
        {(() => {
          const p = resolvePalette(selected) || PALETTES[0];
          return (
            <View style={styles.previewWrap}>
              <Text style={styles.previewLabel}>Anteprima</Text>
              <View style={styles.previewRow}>
                <View style={[styles.previewBtn, { backgroundColor: p.brandPrimary }]}><Text style={styles.previewBtnText}>Pulsante</Text></View>
                <View style={[styles.previewBadge, { backgroundColor: p.brandTertiary }]}><Text style={{ color: p.onBrandTertiary, fontWeight: "800", fontSize: 12 }}>BADGE</Text></View>
                <Ionicons name="heart" size={26} color={p.brandPrimary} />
                <Ionicons name="star" size={26} color={p.brandSecondary} />
              </View>
            </View>
          );
        })()}

        <PressableScale testID="appearance-save" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={busy ? undefined : save}>
          {busy ? <ActivityIndicator color={colors.white} /> : (<><Ionicons name="color-palette" size={18} color={colors.white} /><Text style={styles.saveText}>Applica colore</Text></>)}
        </PressableScale>
        <Text style={styles.note}>Nota: sull'app pubblicata il nuovo colore appare alla riapertura dell'app.</Text>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 13.5, lineHeight: 20, marginBottom: spacing.lg },
  b: { color: colors.brandSecondary, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { width: "47%", flexGrow: 1, backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md },
  swatches: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  swatch: { width: 34, height: 34, borderRadius: radius.sm },
  swatchSm: { width: 26, height: 26 },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardName: { color: colors.white, fontSize: 14, fontWeight: "700", flex: 1 },
  previewWrap: { marginTop: spacing.xl, backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md },
  previewLabel: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  previewBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  previewBtnText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  previewBadge: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.xl },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  note: { color: ADMIN.muted, fontSize: 12, textAlign: "center", marginTop: spacing.md, lineHeight: 17 },
});
