import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AdminShell from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const ADMIN = { bg: "#0B1220", card: "#111C2E", border: "#1E2A3E", muted: "#94A3B8" };

// Each tile links to a REAL, working management tool (not a mockup). Grouped by the
// centralized structure so new tools can be slotted in over time.
const GROUPS: { title: string; items: { label: string; desc: string; icon: any; route?: string; soon?: boolean }[] }[] = [
  {
    title: "Navigazione & Sezioni",
    items: [
      { label: "Navigazione (menu)", desc: "Voci, icone, colori e ordine della barra", icon: "gesture-tap-button", route: "/admin/nav-icons" },
      { label: "Nomi delle sezioni", desc: "Rinomina le sezioni (es. Meditazioni → Parole per te)", icon: "rename-box", route: "/admin/section-names" },
    ],
  },
  {
    title: "Home",
    items: [
      { label: "Layout Home", desc: "Ordine, larghezza, dimensione e visibilità dei blocchi (Mobile/Desktop)", icon: "view-dashboard", route: "/admin/home-layout" },
    ],
  },
  {
    title: "Funzioni & Impostazioni",
    items: [
      { label: "Impostazioni generali", desc: "Attiva/disattiva sezioni e configurazioni del sito", icon: "cog", route: "/admin/settings" },
      { label: "Cartelle Biblioteca", desc: "Organizza i preferiti in cartelle", icon: "folder-multiple", route: "/admin/library-folders" },
      { label: "Assegna contenuti", desc: "Instrada i contenuti nelle cartelle", icon: "folder-move", route: "/admin/content-folders" },
    ],
  },
  {
    title: "Testi & Contenuti",
    items: [
      { label: "Testi del sito", desc: "Modifica titoli, pulsanti e messaggi (Home, Player e sezioni)", icon: "format-text", route: "/admin/site-texts" },
      { label: "Metadati sezione", desc: "Nome, sottotitolo, descrizione, copertina e visibilità di ogni sezione", icon: "card-text-outline", route: "/admin/section-meta" },
    ],
  },
  {
    title: "In arrivo (prossime fasi)",
    items: [
      { label: "Aspetto", desc: "Colori e stile compatibili con il design attuale", icon: "palette", soon: true },
    ],
  },
];

export default function AdminSite() {
  const router = useRouter();
  return (
    <AdminShell title="Personalizzazione sito" activeKey="site">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={styles.intro}>
          <MaterialCommunityIcons name="tune-variant" size={20} color={colors.brandSecondary} />
          <Text style={styles.introText}>Da qui gestisci l'aspetto e i contenuti del sito senza toccare il codice. Ogni riquadro apre uno strumento reale e collegato al sito.</Text>
        </View>

        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {g.items.map((it) => (
              <PressableScale
                key={it.label}
                testID={`site-tile-${it.label}`}
                style={[styles.tile, it.soon && styles.tileSoon]}
                onPress={() => { if (it.route) router.push(it.route as any); }}
              >
                <View style={styles.tileIcon}><MaterialCommunityIcons name={it.icon} size={22} color={it.soon ? ADMIN.muted : colors.brandSecondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileLabel}>{it.label}{it.soon ? "  ·  prossimamente" : ""}</Text>
                  <Text style={styles.tileDesc}>{it.desc}</Text>
                </View>
                {!it.soon && <MaterialCommunityIcons name="chevron-right" size={22} color={ADMIN.muted} />}
              </PressableScale>
            ))}
          </View>
        ))}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary + "12", padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  introText: { flex: 1, color: colors.brandSecondary, fontSize: 13, lineHeight: 18 },
  groupTitle: { color: ADMIN.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  tile: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  tileSoon: { opacity: 0.6 },
  tileIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy },
  tileLabel: { color: colors.white, fontSize: 15, fontWeight: "800" },
  tileDesc: { color: ADMIN.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
});
