import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const FONT_SIZES = [15, 17, 19, 22];

export default function BibleReader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; highlight?: string; ref?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fontIdx, setFontIdx] = useState(1);
  const [picker, setPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const highlight = params.highlight ? parseInt(params.highlight as string, 10) : null;
  const versePos = useRef<Record<number, number>>({});

  useEffect(() => { AsyncStorage.getItem("bible_font").then((v) => v && setFontIdx(parseInt(v, 10))); }, []);

  const loadChapter = useCallback(async (book: number, chapter: number) => {
    setLoading(true);
    try {
      const d = await api.bibleChapter(book, chapter);
      setData(d);
      const pos = { translation: d.translation, book_nr: d.book_nr, book_name: d.book_name, chapter: d.chapter };
      AsyncStorage.setItem("bible_last", JSON.stringify(pos)).catch(() => {});
      api.setBibleState({ book_nr: d.book_nr, chapter: d.chapter }).catch(() => {});
      AsyncStorage.setItem(`bible_ch_${book}_${chapter}`, JSON.stringify(d)).catch(() => {});
    } catch {
      const cached = await AsyncStorage.getItem(`bible_ch_${book}_${chapter}`).catch(() => null);
      if (cached) setData(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let book = params.book ? parseInt(params.book as string, 10) : null;
      let chapter = params.chapter ? parseInt(params.chapter as string, 10) : 1;
      if (!book && params.ref) {
        try { const r = await api.bibleResolve(params.ref as string); book = r.book_nr; chapter = r.chapter; } catch {}
      }
      if (book) loadChapter(book, chapter);
      else setLoading(false);
    })();
  }, [params.book, params.chapter, params.ref]);

  // Scroll to highlighted verse once laid out.
  useEffect(() => {
    if (!data || !highlight) return;
    const t = setTimeout(() => {
      const y = versePos.current[highlight];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }, 400);
    return () => clearTimeout(t);
  }, [data, highlight]);

  const changeFont = () => {
    const next = (fontIdx + 1) % FONT_SIZES.length;
    setFontIdx(next);
    AsyncStorage.setItem("bible_font", String(next)).catch(() => {});
  };
  const goChapter = (c: number) => { setPicker(false); if (data) loadChapter(data.book_nr, c); };
  const fs = FONT_SIZES[fontIdx];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LinearGradient colors={["#0B2A4A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <PressableScale testID="chapter-title" onPress={() => setPicker(true)} style={styles.titleBtn}>
            <Text style={styles.title}>{data ? `${data.book_name} ${data.chapter}` : "Bibbia"}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.white} />
          </PressableScale>
          <PressableScale testID="font-toggle" onPress={changeFont} style={styles.iconBtn}><Text style={styles.aA}>A</Text></PressableScale>
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : !data ? (
        <View style={styles.center}><Text style={styles.dim}>Capitolo non disponibile.</Text></View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {data.verses.map((v: any) => (
            <View key={v.verse} onLayout={(e) => { versePos.current[v.verse] = e.nativeEvent.layout.y; }}
              style={[styles.verseRow, highlight === v.verse && styles.verseHi]}>
              <Text style={[styles.vnum, { fontSize: fs - 5 }]}>{v.verse}</Text>
              <Text style={[styles.vtext, { fontSize: fs, lineHeight: fs * 1.55 }]}>{v.text}</Text>
            </View>
          ))}

          <View style={styles.navRow}>
            <PressableScale testID="prev-chapter" disabled={data.chapter <= 1} style={[styles.navBtn, data.chapter <= 1 && styles.navOff]} onPress={() => goChapter(data.chapter - 1)}>
              <Ionicons name="chevron-back" size={18} color={colors.navy} /><Text style={styles.navText}>Precedente</Text>
            </PressableScale>
            <PressableScale testID="next-chapter" disabled={data.chapter >= data.chapters_count} style={[styles.navBtn, data.chapter >= data.chapters_count && styles.navOff]} onPress={() => goChapter(data.chapter + 1)}>
              <Text style={styles.navText}>Successivo</Text><Ionicons name="chevron-forward" size={18} color={colors.navy} />
            </PressableScale>
          </View>
        </ScrollView>
      )}

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{data?.book_name} — capitolo</Text>
            <ScrollView contentContainerStyle={styles.chGrid}>
              {data && Array.from({ length: data.chapters_count }).map((_, i) => (
                <PressableScale key={i} style={[styles.chCell, data.chapter === i + 1 && styles.chCellOn]} onPress={() => goChapter(i + 1)}>
                  <Text style={[styles.chText, data.chapter === i + 1 && { color: colors.white }]}>{i + 1}</Text>
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
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  aA: { color: colors.white, fontSize: 18, fontWeight: "800" },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { color: colors.white, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dim: { color: colors.onSurfaceSecondary, fontSize: 15 },
  verseRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, paddingHorizontal: 6 },
  verseHi: { backgroundColor: colors.brandTertiary },
  vnum: { color: colors.brandPrimary, fontWeight: "800", marginTop: 3, minWidth: 20 },
  vtext: { flex: 1, color: colors.onSurface },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginTop: spacing["2xl"] },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: radius.pill },
  navOff: { opacity: 0.4 },
  navText: { color: colors.navy, fontSize: 14, fontWeight: "800" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(6,10,26,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: "70%" },
  sheetTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginBottom: spacing.md },
  chGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  chCell: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chCellOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chText: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
});
