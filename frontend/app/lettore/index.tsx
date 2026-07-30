import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { FishingNet, SeaWaves, SunriseGlow } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function BibleHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [books, setBooks] = useState<{ at: any[]; nt: any[] }>({ at: [], nt: [] });
  const [tab, setTab] = useState<"AT" | "NT">("AT");
  const [loading, setLoading] = useState(true);
  const [last, setLast] = useState<any>(null);
  const [picker, setPicker] = useState<any>(null); // selected book for chapter picker
  const [w, setW] = useState(0);

  useFocusEffect(useCallback(() => {
    api.bibleBooks().then(setBooks).catch(() => {}).finally(() => setLoading(false));
    AsyncStorage.getItem("bible_last").then((c) => c && setLast(JSON.parse(c))).catch(() => {});
  }, []));

  const openChapter = (book: any, chapter: number) => {
    setPicker(null);
    router.push(`/lettore/read?book=${book.book_nr}&chapter=${chapter}`);
  };

  const list = tab === "AT" ? books.at : books.nt;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (<><SunriseGlow width={w} height={150} /><FishingNet width={w} height={150} gap={28} opacity={0.06} /><SeaWaves width={w} height={54} /></>)}
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <Text style={styles.topTitle}>Bibbia</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <PressableScale testID="bible-saved-open" onPress={() => router.push("/lettore/salvati")} style={styles.iconBtn}><Ionicons name="bookmark" size={18} color={colors.white} /></PressableScale>
            <PressableScale testID="bible-search-open" onPress={() => router.push("/lettore/search")} style={styles.iconBtn}><Ionicons name="search" size={20} color={colors.white} /></PressableScale>
          </View>
        </View>
        <Text style={styles.heroSub}>Riveduta (Luzzi 1927)</Text>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {last && (
            <PressableScale testID="bible-continue" style={styles.continueCard} onPress={() => router.push(`/lettore/read?book=${last.book_nr}&chapter=${last.chapter}`)}>
              <View style={styles.continueIcon}><Ionicons name="book" size={20} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.continueLabel}>Continua a leggere</Text>
                <Text style={styles.continueRef}>{last.book_name} {last.chapter}</Text>
              </View>
              <Ionicons name="play" size={18} color={colors.brandPrimary} />
            </PressableScale>
          )}

          <View style={styles.tabs}>
            {(["AT", "NT"] as const).map((t) => (
              <Pressable key={t} testID={`bible-tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === "AT" ? "Antico Testamento" : "Nuovo Testamento"}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.grid}>
            {list.map((b) => (
              <PressableScale key={b.book_nr} testID={`bible-book-${b.book_nr}`} style={styles.bookChip} onPress={() => setPicker(b)}>
                <Text style={styles.bookName} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.bookCh}>{b.chapters_count} cap.</Text>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Chapter picker */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{picker?.name}</Text>
            <ScrollView contentContainerStyle={styles.chGrid}>
              {picker && Array.from({ length: picker.chapters_count }).map((_, i) => (
                <PressableScale key={i} testID={`bible-ch-${i + 1}`} style={styles.chCell} onPress={() => openChapter(picker, i + 1)}>
                  <Text style={styles.chText}>{i + 1}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  topTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  heroSub: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  continueCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  continueIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  continueLabel: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "700" },
  continueRef: { color: colors.navy, fontSize: 16, fontWeight: "800", marginTop: 2 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center" },
  tabOn: { backgroundColor: colors.navy },
  tabText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  bookChip: { width: "31.5%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  bookName: { color: colors.onSurface, fontSize: 13.5, fontWeight: "800" },
  bookCh: { color: colors.muted, fontSize: 11, marginTop: 3 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(6,10,26,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: "70%" },
  sheetTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginBottom: spacing.md },
  chGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  chCell: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chText: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
});
