import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import ShareVerseSheet from "@/src/components/ShareVerseSheet";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const FONT_SIZES = [15, 17, 19, 22];
const HL_COLORS: Record<string, string> = { yellow: "#FEF3C7", green: "#D1FAE5", blue: "#DBEAFE", pink: "#FCE7F3" };

export default function BibleReader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; highlight?: string; highlightEnd?: string; ref?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fontIdx, setFontIdx] = useState(1);
  const [picker, setPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const hlStart = params.highlight ? parseInt(params.highlight as string, 10) : null;
  const hlEnd = params.highlightEnd ? parseInt(params.highlightEnd as string, 10) : hlStart;
  const versePos = useRef<Record<number, number>>({});
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Record<number, { id: string; color: string }>>({});
  const [notes, setNotes] = useState<Record<number, { id: string; note: string }>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [noteEditor, setNoteEditor] = useState<{ verse: number; id?: string; text: string } | null>(null);
  const [shareVerse, setShareVerse] = useState<any>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const loadAnnotations = useCallback(async (book: number, chapter: number) => {
    if (!user) { setBookmarks({}); setNotes({}); return; }
    try {
      const a = await api.bibleAnnotations(book, chapter);
      const bm: any = {}; (a.bookmarks || []).forEach((b: any) => { bm[b.verse] = { id: b.id, color: b.color }; });
      const nt: any = {}; (a.notes || []).forEach((n: any) => { nt[n.verse] = { id: n.id, note: n.note }; });
      setBookmarks(bm); setNotes(nt);
    } catch { setBookmarks({}); setNotes({}); }
  }, [user]);

  useEffect(() => { AsyncStorage.getItem("bible_font").then((v) => v && setFontIdx(parseInt(v, 10))); }, []);

  const loadChapter = useCallback(async (book: number, chapter: number) => {
    setLoading(true);
    try {
      const d = await api.bibleChapter(book, chapter);
      setData(d);
      loadAnnotations(d.book_nr, d.chapter);
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

  // Scroll to the first highlighted verse once laid out.
  useEffect(() => {
    if (!data || hlStart == null) return;
    const t = setTimeout(() => {
      const y = versePos.current[hlStart];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }, 400);
    return () => clearTimeout(t);
  }, [data, hlStart]);

  const changeFont = () => {
    const next = (fontIdx + 1) % FONT_SIZES.length;
    setFontIdx(next);
    AsyncStorage.setItem("bible_font", String(next)).catch(() => {});
  };
  const goChapter = (c: number) => { setPicker(false); if (data) loadChapter(data.book_nr, c); };
  const fs = FONT_SIZES[fontIdx];

  const verseText = (n: number) => (data?.verses.find((v: any) => v.verse === n)?.text) || "";
  const refOf = (n: number) => `${data?.book_name} ${data?.chapter}:${n}`;
  const onLongPress = (verse: number) => { if (!user) { setLoginPrompt(true); return; } setSelected(verse); };

  const setHighlight = async (color: string) => {
    if (selected == null || !data) return;
    const v = selected; setSelected(null);
    try {
      const r = await api.bibleSaveBookmark({ translation: data.translation, book_nr: data.book_nr, book_name: data.book_name, chapter: data.chapter, verse: v, color, text: verseText(v) });
      setBookmarks((p) => ({ ...p, [v]: { id: r.id, color } }));
    } catch {}
  };
  const removeHighlight = async () => {
    if (selected == null) return; const v = selected; setSelected(null);
    const bm = bookmarks[v]; if (!bm) return;
    try { await api.bibleDeleteBookmark(bm.id); setBookmarks((p) => { const n = { ...p }; delete n[v]; return n; }); } catch {}
  };
  const saveNote = async () => {
    if (!noteEditor || !data) return;
    const { verse, id, text } = noteEditor;
    const body = text.trim(); if (!body) { setNoteEditor(null); return; }
    try {
      if (id) { await api.bibleEditNote(id, body); setNotes((p) => ({ ...p, [verse]: { id, note: body } })); }
      else { const r = await api.bibleCreateNote({ translation: data.translation, book_nr: data.book_nr, book_name: data.book_name, chapter: data.chapter, verse, note: body, text: verseText(verse) }); setNotes((p) => ({ ...p, [verse]: { id: r.id, note: body } })); }
    } catch {}
    setNoteEditor(null);
  };
  const deleteNote = async () => {
    if (!noteEditor?.id) { setNoteEditor(null); return; }
    const { verse, id } = noteEditor;
    try { await api.bibleDeleteNote(id); setNotes((p) => { const n = { ...p }; delete n[verse]; return n; }); } catch {}
    setNoteEditor(null);
  };

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
          {data.verses.map((v: any) => {
            const bm = bookmarks[v.verse];
            const note = notes[v.verse];
            const bg = bm ? HL_COLORS[bm.color] || HL_COLORS.yellow : ((hlStart != null && v.verse >= hlStart && v.verse <= (hlEnd ?? hlStart)) ? colors.brandTertiary : undefined);
            return (
              <Pressable key={v.verse} onLongPress={() => onLongPress(v.verse)} delayLongPress={250}
                onLayout={(e) => { versePos.current[v.verse] = e.nativeEvent.layout.y; }}
                style={[styles.verseRow, bg ? { backgroundColor: bg } : null]}>
                <Text style={[styles.vnum, { fontSize: fs - 5 }]}>{v.verse}</Text>
                <Text style={[styles.vtext, { fontSize: fs, lineHeight: fs * 1.55 }, bg ? { color: colors.navy } : null]}>{v.text}</Text>
                {note ? <Ionicons name="document-text" size={14} color={colors.brandPrimary} style={{ marginTop: 3 }} /> : null}
              </Pressable>
            );
          })}

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

      {/* Verse action sheet */}
      <Modal visible={selected != null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected != null && (
              <>
                <Text style={styles.sheetTitle}>{refOf(selected)}</Text>
                <Text style={styles.sheetVerse} numberOfLines={3}>{verseText(selected)}</Text>
                <Text style={styles.sheetLabel}>Evidenzia</Text>
                <View style={styles.swatchRow}>
                  {Object.keys(HL_COLORS).map((c) => (
                    <PressableScale key={c} testID={`hl-${c}`} style={[styles.swatch, { backgroundColor: HL_COLORS[c] }, bookmarks[selected]?.color === c && styles.swatchOn]} onPress={() => setHighlight(c)} />
                  ))}
                  {bookmarks[selected] && (
                    <PressableScale testID="hl-remove" style={styles.swatchRemove} onPress={removeHighlight}><Ionicons name="close" size={18} color={colors.error} /></PressableScale>
                  )}
                </View>
                <PressableScale testID="verse-note" style={styles.sheetAction} onPress={() => { const v = selected!; setSelected(null); setNoteEditor({ verse: v, id: notes[v]?.id, text: notes[v]?.note || "" }); }}>
                  <Ionicons name="create-outline" size={20} color={colors.navy} />
                  <Text style={styles.sheetActionText}>{notes[selected] ? "Modifica nota" : "Aggiungi nota"}</Text>
                </PressableScale>
                <PressableScale testID="verse-share2" style={styles.sheetAction} onPress={() => { const v = selected!; setSelected(null); setShareVerse({ text: verseText(v), reference: refOf(v) }); }}>
                  <Ionicons name="share-social-outline" size={20} color={colors.navy} />
                  <Text style={styles.sheetActionText}>Condividi versetto</Text>
                </PressableScale>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Note editor */}
      <Modal visible={!!noteEditor} transparent animationType="fade" onRequestClose={() => setNoteEditor(null)}>
        <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, width: "100%" }} onPress={() => setNoteEditor(null)} />
          <View style={styles.noteSheet}>
            <Text style={styles.sheetTitle}>{noteEditor ? refOf(noteEditor.verse) : ""}</Text>
            <Text style={styles.notePrivate}>🔒 Nota personale privata</Text>
            <TextInput testID="note-input" value={noteEditor?.text || ""} onChangeText={(t) => setNoteEditor((p) => p ? { ...p, text: t } : p)}
              multiline placeholder="Scrivi qui la tua riflessione..." placeholderTextColor={colors.muted} style={styles.noteInput} autoFocus />
            <View style={styles.noteBtns}>
              {noteEditor?.id ? <PressableScale testID="note-delete" style={[styles.noteBtn, { backgroundColor: colors.error }]} onPress={deleteNote}><Text style={styles.noteBtnText}>Elimina</Text></PressableScale> : null}
              <PressableScale testID="note-save" style={[styles.noteBtn, { backgroundColor: colors.brandPrimary, flex: 1 }]} onPress={saveNote}><Text style={styles.noteBtnText}>Salva</Text></PressableScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Login prompt for guests */}
      <Modal visible={loginPrompt} transparent animationType="fade" onRequestClose={() => setLoginPrompt(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setLoginPrompt(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Ionicons name="bookmark" size={28} color={colors.brandPrimary} style={{ alignSelf: "center" }} />
            <Text style={[styles.sheetTitle, { textAlign: "center", marginTop: spacing.sm }]}>Accedi per salvare</Text>
            <Text style={[styles.sheetVerse, { textAlign: "center" }]}>Crea un account per evidenziare versetti, salvarli nei preferiti e aggiungere note personali.</Text>
            <PressableScale style={[styles.sheetAction, { justifyContent: "center", marginTop: spacing.md }]} onPress={() => { setLoginPrompt(false); router.push("/profilo"); }}>
              <Text style={styles.sheetActionText}>Accedi / Registrati</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      <ShareVerseSheet verse={shareVerse} visible={!!shareVerse} onClose={() => setShareVerse(null)} />
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
  sheetVerse: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  sheetLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  swatchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.border },
  swatchOn: { borderColor: colors.navy, borderWidth: 3 },
  swatchRemove: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.error, alignItems: "center", justifyContent: "center" },
  sheetAction: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  sheetActionText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
  noteSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  notePrivate: { color: colors.muted, fontSize: 12, marginBottom: spacing.md },
  noteInput: { minHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, fontSize: 15, textAlignVertical: "top" },
  noteBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  noteBtn: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill },
  noteBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
