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
  const [translations, setTranslations] = useState<any[]>([]);
  const [trCode, setTrCode] = useState<string>("riveduta_1927");
  const [trName, setTrName] = useState<string>("Riveduta (Luzzi 1927)");
  const [trPicker, setTrPicker] = useState(false);

  const loadBooks = useCallback((code: string) => {
    setLoading(true);
    api.bibleBooks(code).then(setBooks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      const stored = await AsyncStorage.getItem("bible_translation").catch(() => null);
      let list: any[] = [];
      try { list = await api.bibleTranslations(); } catch {}
      if (!mounted) return;
      setTranslations(list || []);
      const def = (list || []).find((t: any) => t.is_default) || (list || [])[0];
      const code = stored || def?.code || "riveduta_1927";
      const cur = (list || []).find((t: any) => t.code === code) || def;
      setTrCode(cur?.code || "riveduta_1927");
      setTrName(cur?.name || "Riveduta (Luzzi 1927)");
      loadBooks(cur?.code || "riveduta_1927");
    })();
    AsyncStorage.getItem("bible_last").then((c) => c && setLast(JSON.parse(c))).catch(() => {});
    return () => { mounted = false; };
  }, [loadBooks]));

  const selectTranslation = (t: any) => {
    setTrPicker(false);
    if (t.code === trCode) return;
    setTrCode(t.code);
    setTrName(t.name);
    AsyncStorage.setItem("bible_translation", t.code).catch(() => {});
    loadBooks(t.code);
  };

  const openChapter = (book: any, chapter: number) => {
    setPicker(null);
    router.push(`/lettore/read?book=${book.book_nr}&chapter=${chapter}&translation=${trCode}`);
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
            <PressableScale testID="bible-plans-open" onPress={() => router.push("/lettore/piani")} style={styles.iconBtn}><Ionicons name="reader" size={18} color={colors.white} /></PressableScale>
            <PressableScale testID="bible-saved-open" onPress={() => router.push("/lettore/salvati")} style={styles.iconBtn}><Ionicons name="bookmark" size={18} color={colors.white} /></PressableScale>
            <PressableScale testID="bible-search-open" onPress={() => router.push("/lettore/search")} style={styles.iconBtn}><Ionicons name="search" size={20} color={colors.white} /></PressableScale>
          </View>
        </View>
        <PressableScale testID="bible-translation-btn" onPress={() => setTrPicker(true)} style={styles.trBtn}>
          <Ionicons name="book-outline" size={13} color={colors.brandSecondary} />
          <Text style={styles.heroSub}>{trName}</Text>
          <Ionicons name="chevron-down" size={15} color={colors.brandSecondary} />
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {last && (
            <PressableScale testID="bible-continue" style={styles.continueCard} onPress={() => router.push(`/lettore/read?book=${last.book_nr}&chapter=${last.chapter}&translation=${trCode}`)}>
              <View style={styles.continueIcon}><Ionicons name="book" size={20} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.continueLabel}>Continua a leggere</Text>
                <Text style={styles.continueRef}>{last.book_name} {last.chapter}</Text>
              </View>
              <Ionicons name="play" size={18} color={colors.brandPrimary} />
            </PressableScale>
          )}

          <PressableScale testID="bible-plans-card" style={styles.plansCard} onPress={() => router.push("/lettore/piani")}>
            <View style={styles.plansIcon}><Ionicons name="reader" size={22} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.plansTitle}>Piani di Lettura</Text>
              <Text style={styles.plansSub}>Segui un cammino guidato nella Parola</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </PressableScale>

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

      {/* Translation picker */}
      <Modal visible={trPicker} transparent animationType="fade" onRequestClose={() => setTrPicker(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTrPicker(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Versione della Bibbia</Text>
            {translations.map((t) => (
              <PressableScale key={t.code} testID={`bible-tr-${t.code}`} style={[styles.trRow, t.code === trCode && styles.trRowOn]} onPress={() => selectTranslation(t)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trRowName}>{t.name}</Text>
                  <Text style={styles.trRowMeta}>{t.short} · Pubblico dominio</Text>
                </View>
                {t.code === trCode
                  ? <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />
                  : <Ionicons name="ellipse-outline" size={22} color={colors.muted} />}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

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
  heroSub: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
  trBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: spacing.sm, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  trRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  trRowOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  trRowName: { color: colors.onSurface, fontSize: 15.5, fontWeight: "800" },
  trRowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  continueCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  continueIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  continueLabel: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "700" },
  continueRef: { color: colors.navy, fontSize: 16, fontWeight: "800", marginTop: 2 },
  plansCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.navy, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  plansIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  plansTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  plansSub: { color: colors.brandSecondary, fontSize: 12, fontWeight: "600", marginTop: 2 },
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
