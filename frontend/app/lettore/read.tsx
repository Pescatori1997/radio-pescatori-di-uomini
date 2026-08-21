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

// Reading themes (applied ONLY to the reader screen). bg + default text color.
const READ_THEMES = [
  { key: "white", name: "Bianco", bg: "#FFFFFF", text: "#0A1128" },
  { key: "sepia", name: "Seppia", bg: "#F4ECD8", text: "#4A3B28" },
  { key: "gray", name: "Grigio chiaro", bg: "#E9EDF2", text: "#1A2433" },
  { key: "night", name: "Notte", bg: "#0F1522", text: "#E6EAF2" },
];
const TEXT_COLORS = ["#0A1128", "#4A3B28", "#1A2433", "#334155", "#5B21B6", "#E6EAF2"];
const themeByKey = (k?: string | null) => READ_THEMES.find((t) => t.key === k) || READ_THEMES[0];

export default function BibleReader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; highlight?: string; highlightEnd?: string; ref?: string; translation?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const trRef = useRef<string | undefined>(params.translation as string | undefined);
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
  const [xrefs, setXrefs] = useState<any[] | null>(null);
  const [xrefsLoading, setXrefsLoading] = useState(false);
  const [readSettings, setReadSettings] = useState(false);
  const [themeKey, setThemeKey] = useState("white");
  const [textColor, setTextColor] = useState<string | null>(null);
  const theme = themeByKey(themeKey);
  const vColor = textColor || theme.text;

  const loadAnnotations = useCallback(async (book: number, chapter: number) => {
    if (!user) { setBookmarks({}); setNotes({}); return; }
    try {
      const a = await api.bibleAnnotations(book, chapter);
      const bm: any = {}; (a.bookmarks || []).forEach((b: any) => { bm[b.verse] = { id: b.id, color: b.color }; });
      const nt: any = {}; (a.notes || []).forEach((n: any) => { nt[n.verse] = { id: n.id, note: n.note }; });
      setBookmarks(bm); setNotes(nt);
    } catch { setBookmarks({}); setNotes({}); }
  }, [user]);

  useEffect(() => {
    AsyncStorage.getItem("bible_font").then((v) => v && setFontIdx(parseInt(v, 10)));
    AsyncStorage.getItem("bible_reader_theme").then((v) => v && setThemeKey(v));
    AsyncStorage.getItem("bible_text_color").then((v) => v && setTextColor(v));
  }, []);

  const loadChapter = useCallback(async (book: number, chapter: number) => {
    setLoading(true);
    try {
      const d = await api.bibleChapter(book, chapter, trRef.current);
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
      if (!trRef.current) {
        trRef.current = (await AsyncStorage.getItem("bible_translation").catch(() => null)) || undefined;
      }
      let book = params.book ? parseInt(params.book as string, 10) : null;
      let chapter = params.chapter ? parseInt(params.chapter as string, 10) : 1;
      if (!book && params.ref) {
        try { const r = await api.bibleResolve(params.ref as string, trRef.current); book = r.book_nr; chapter = r.chapter; } catch {}
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

  const incFont = () => { const n = Math.min(FONT_SIZES.length - 1, fontIdx + 1); setFontIdx(n); AsyncStorage.setItem("bible_font", String(n)).catch(() => {}); };
  const decFont = () => { const n = Math.max(0, fontIdx - 1); setFontIdx(n); AsyncStorage.setItem("bible_font", String(n)).catch(() => {}); };
  const goChapter = (c: number) => { setPicker(false); if (data) loadChapter(data.book_nr, c); };
  const fs = FONT_SIZES[fontIdx];

  const verseText = (n: number) => (data?.verses.find((v: any) => v.verse === n)?.text) || "";
  const refOf = (n: number) => `${data?.book_name} ${data?.chapter}:${n}`;
  const openPanel = (verse: number) => {
    setSelected(verse);
    setXrefs(null);
    if (data) {
      setXrefsLoading(true);
      api.bibleXrefs(data.book_nr, data.chapter, verse, data.translation)
        .then((r: any) => setXrefs(r.refs || []))
        .catch(() => setXrefs([]))
        .finally(() => setXrefsLoading(false));
    }
  };

  const openXref = (r: any) => {
    setSelected(null);
    router.push(`/lettore/read?book=${r.book_nr}&chapter=${r.chapter}&highlight=${r.verse}${r.verse_end && r.verse_end > r.verse ? `&highlightEnd=${r.verse_end}` : ""}&translation=${data?.translation || ""}`);
  };

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
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LinearGradient colors={["#0B2A4A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <PressableScale testID="chapter-title" onPress={() => setPicker(true)} style={styles.titleBtn}>
            <Text style={styles.title}>{data ? `${data.book_name} ${data.chapter}` : "Bibbia"}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.white} />
          </PressableScale>
          <View style={styles.fontBtns}>
            <PressableScale testID="font-dec" onPress={decFont} style={styles.iconBtnSm}><Text style={styles.aA}>−</Text></PressableScale>
            <PressableScale testID="font-inc" onPress={incFont} style={styles.iconBtnSm}><Text style={styles.aA}>+</Text></PressableScale>
            <PressableScale testID="read-settings" onPress={() => setReadSettings(true)} style={styles.iconBtnSm}><Ionicons name="color-palette-outline" size={18} color={colors.white} /></PressableScale>
          </View>
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
              <View key={v.verse}
                onLayout={(e) => { versePos.current[v.verse] = e.nativeEvent.layout.y; }}
                style={[styles.verseRow, bg ? { backgroundColor: bg } : null]}>
                <Pressable testID={`verse-num-${v.verse}`} onPress={() => openPanel(v.verse)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.vnum, { fontSize: fs - 5 }, bg ? { color: colors.navy } : null]}>{v.verse}</Text>
                </Pressable>
                <Text style={[styles.vtext, { fontSize: fs, lineHeight: fs * 1.55, color: vColor }, bg ? { color: colors.navy } : null]}>{v.text}</Text>
                {note ? <Ionicons name="document-text" size={14} color={colors.brandPrimary} style={{ marginTop: 3 }} /> : null}
              </View>
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
                {user ? (
                  <>
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
                  </>
                ) : (
                  <PressableScale testID="verse-login" style={styles.sheetAction} onPress={() => { setSelected(null); setLoginPrompt(true); }}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.navy} />
                    <Text style={styles.sheetActionText}>Accedi per evidenziare e annotare</Text>
                  </PressableScale>
                )}
                <PressableScale testID="verse-share2" style={styles.sheetAction} onPress={() => { const v = selected!; setSelected(null); setShareVerse({ text: verseText(v), reference: refOf(v) }); }}>
                  <Ionicons name="share-social-outline" size={20} color={colors.navy} />
                  <Text style={styles.sheetActionText}>Condividi versetto</Text>
                </PressableScale>

                <Text style={[styles.sheetLabel, { marginTop: spacing.md }]}>Versetti collegati</Text>
                {xrefsLoading ? (
                  <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.md }} />
                ) : (xrefs && xrefs.length > 0) ? (
                  <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
                    {xrefs.map((r, i) => (
                      <PressableScale key={i} testID={`xref-${i}`} style={styles.xrefRow} onPress={() => openXref(r)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.xrefRef}>{r.reference}</Text>
                          {!!r.text && <Text style={styles.xrefText} numberOfLines={2}>{r.text}</Text>}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                      </PressableScale>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.xrefEmpty}>Nessun rimando per questo versetto.</Text>
                )}
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
            <Text style={[styles.sheetVerse, { textAlign: "center" }]}>Crea un account per evidenziare versetti e aggiungere note personali.</Text>
            <PressableScale style={[styles.sheetAction, { justifyContent: "center", marginTop: spacing.md }]} onPress={() => { setLoginPrompt(false); router.push("/profilo"); }}>
              <Text style={styles.sheetActionText}>Accedi / Registrati</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reading settings: background + text color (reader only) */}
      <Modal visible={readSettings} transparent animationType="fade" onRequestClose={() => setReadSettings(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setReadSettings(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Impostazioni di lettura</Text>
            <Text style={styles.sheetLabel}>Sfondo</Text>
            <View style={styles.themeRow}>
              {READ_THEMES.map((t) => (
                <PressableScale key={t.key} testID={`read-theme-${t.key}`}
                  style={[styles.themeChip, { backgroundColor: t.bg }, themeKey === t.key && styles.themeChipOn]}
                  onPress={() => { setThemeKey(t.key); setTextColor(null); AsyncStorage.setItem("bible_reader_theme", t.key).catch(() => {}); AsyncStorage.removeItem("bible_text_color").catch(() => {}); }}>
                  <Text style={[styles.themeAa, { color: t.text }]}>Aa</Text>
                  <Text style={[styles.themeName, { color: t.text }]}>{t.name}</Text>
                </PressableScale>
              ))}
            </View>
            <Text style={[styles.sheetLabel, { marginTop: spacing.md }]}>Colore del testo</Text>
            <View style={styles.swatchRow}>
              {TEXT_COLORS.map((c) => (
                <PressableScale key={c} testID={`text-color-${c}`}
                  style={[styles.textSwatch, { backgroundColor: c }, vColor.toLowerCase() === c.toLowerCase() && styles.swatchOn]}
                  onPress={() => { setTextColor(c); AsyncStorage.setItem("bible_text_color", c).catch(() => {}); }} />
              ))}
            </View>
            <View style={[styles.readPreview, { backgroundColor: theme.bg }]}>
              <Text style={{ color: vColor, fontSize: fs, lineHeight: fs * 1.55 }}>«Lampada al mio piede è la tua parola, e luce al mio sentiero.»</Text>
            </View>
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
  fontBtns: { flexDirection: "row", gap: 6 },
  iconBtnSm: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
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
  xrefRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  xrefRef: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  xrefText: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  xrefEmpty: { color: colors.muted, fontSize: 13, fontStyle: "italic", paddingVertical: spacing.sm },
  xrefCredit: { color: colors.muted, fontSize: 10.5, marginTop: 6 },
  themeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  themeChip: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  themeChipOn: { borderColor: colors.brandPrimary },
  themeAa: { fontSize: 20, fontWeight: "900" },
  themeName: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  textSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.border },
  readPreview: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  noteSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  notePrivate: { color: colors.muted, fontSize: 12, marginBottom: spacing.md },
  noteInput: { minHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, fontSize: 15, textAlignVertical: "top" },
  noteBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  noteBtn: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill },
  noteBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
