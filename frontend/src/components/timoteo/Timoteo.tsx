import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer } from "@/src/context/PlayerContext";
import { buildGreeting, getGreetingPrefs } from "./greeting";
import { colors, spacing, radius } from "@/src/theme";

const TIMOTEO_IMG = require("@/assets/images/timoteo.png");

type Action = { type: "radio_live" | "open" | "screen"; label: string; path?: string; screen?: string };
type Msg = { role: "user" | "assistant"; content: string; actions?: Action[]; welcome?: boolean; streaming?: boolean };

// Frontend twin of the backend SCREENS registry. Add a feature = add one line.
const SCREEN_PATHS: Record<string, string> = {
  home: "/(tabs)",
  podcast: "/podcast",
  meditazioni: "/meditazioni",
  news: "/news",
  palinsesto: "/palinsesto",
  profilo: "/profilo",
  prayer: "/prayer",
  prayer_board: "/prayer-board",
  bibbia: "/lettore",
  bible_search: "/lettore/search",
  reading_plans: "/lettore/piani",
  saved_bible: "/lettore/salvati",
  studi_biblici: "/c/studi-biblici",
  predicazioni: "/c/predicazioni",
  video: "/c/video",
  eventi: "/c/eventi",
  galleria: "/c/galleria",
  download: "/c/download",
  settings: "/settings",
  donate: "/donate",
  weather: "/weather",
  about: "/about",
  contact: "/contact",
};

const QUICK: { icon: string; label: string; prompt: string }[] = [
  { icon: "📖", label: "Trova un versetto", prompt: "Trova un versetto" },
  { icon: "🎙️", label: "Cerca un podcast", prompt: "Cerca un podcast" },
  { icon: "📻", label: "Ascolta la radio", prompt: "Ascolta la radio" },
  { icon: "🙏", label: "Richieste di preghiera", prompt: "Apri le richieste di preghiera" },
  { icon: "📚", label: "Studi biblici", prompt: "Apri gli studi biblici" },
  { icon: "📰", label: "Ultime notizie", prompt: "Mostrami le ultime notizie" },
  { icon: "💭", label: "Meditazioni", prompt: "Apri le meditazioni" },
  { icon: "👤", label: "Il mio profilo", prompt: "Apri il mio profilo" },
  { icon: "⚙️", label: "Impostazioni", prompt: "Apri le impostazioni" },
];

const HIDDEN_ROOTS = ["welcome", "auth", "login", "invite", "reset-password", "admin", "player"];

const STORAGE_KEY = "timoteo_chat_v1";

export default function Timoteo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuth();
  const { playLive } = usePlayer();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<null | (() => void)>(null);

  const root = (segments[0] as string) || "";
  const hidden = HIDDEN_ROOTS.includes(root);

  // Restore the previous conversation once at mount so it survives closing the
  // panel, navigating away, and even fully reopening the app.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Msg[];
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        }
      } catch { /* ignore */ }
      finally { setRestored(true); }
    })();
  }, []);

  // Persist the conversation whenever it changes (keep it compact). Strip the
  // transient `streaming` flag / empty placeholder so a killed stream never
  // restores a half-written bubble.
  useEffect(() => {
    if (!restored) return;
    const toSave = messages
      .filter((m) => !(m.streaming && !m.content))
      .map(({ streaming, ...m }) => m) // eslint-disable-line @typescript-eslint/no-unused-vars
      .slice(-40);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [messages, restored]);

  // Personalized welcome the first time the panel opens with no prior chat.
  useEffect(() => {
    if (!open || !restored || messages.length > 0) return;
    (async () => {
      const { mode, title } = await getGreetingPrefs();
      const hi = buildGreeting(user?.name, mode, title);
      setMessages([{
        role: "assistant",
        welcome: true,
        content: `${hi} Sono Timoteo.\nSono qui per aiutarti a trovare rapidamente ciò che cerchi e guidarti nell'utilizzo della piattaforma.`,
      }]);
    })();
  }, [open, restored]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetChat = () => {
    try { abortRef.current?.(); } catch { /* noop */ }
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setLoading(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const runAction = (a: Action) => {
    setOpen(false);
    if (a.type === "radio_live") { playLive(); router.push("/player"); return; }
    if (a.type === "open" && a.path) { router.push(a.path as any); return; }
    if (a.type === "screen") { router.push((SCREEN_PATHS[a.screen || ""] || "/(tabs)") as any); return; }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next = [...messages, { role: "user", content: t } as Msg];
    setMessages(next);
    setInput("");
    setLoading(true);
    const payload = next
      .filter((m) => !m.welcome)
      .map((m) => ({ role: m.role, content: m.content }));

    let started = false;
    const onDelta = (chunk: string) => {
      if (!started) {
        started = true;
        setMessages((m) => [...m, { role: "assistant", content: chunk, streaming: true }]);
      } else {
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && last.streaming) {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
      }
    };
    const onDone = ({ reply, actions }: { reply: string; actions: any[] }) => {
      setLoading(false);
      abortRef.current = null;
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming) {
          copy[copy.length - 1] = { role: "assistant", content: reply || last.content, actions: actions || [] };
        } else {
          copy.push({ role: "assistant", content: reply || "", actions: actions || [] });
        }
        return copy;
      });
    };
    const onError = () => {
      setLoading(false);
      abortRef.current = null;
      setMessages((m) => {
        const copy = m.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming && !last.content) copy.pop();
        copy.push({ role: "assistant", content: "Mi dispiace, in questo momento ho difficoltà a rispondere. Riprova tra poco.", actions: [] });
        return copy;
      });
    };
    abortRef.current = api.timoteoStream(payload, { onDelta, onDone, onError });
  };

  if (hidden) return null;

  const showSuggestions = messages.length <= 1;
  const lastMsg = messages[messages.length - 1];
  const streamingNow = !!(lastMsg && lastMsg.role === "assistant" && lastMsg.streaming);

  return (
    <>
      {/* Linguetta laterale (segnalibro): non copre i contenuti e non entra in
          conflitto con lo scorrimento della pagina. Al tocco apre Timoteo. */}
      <Pressable
        testID="timoteo-fab"
        accessibilityLabel="Apri Timoteo, la guida"
        onPress={() => setOpen(true)}
        style={[styles.tab, { top: insets.top + 120 }]}
      >
        <Image source={TIMOTEO_IMG} style={styles.tabImg} contentFit="cover" />
        <Text style={styles.tabText}>TIMOTEO</Text>
      </Pressable>

      {open && (
        <View style={styles.overlayRoot} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
            pointerEvents="box-none"
          >
            <Animated.View
              entering={SlideInDown.duration(240)}
              exiting={SlideOutDown.duration(180)}
              style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}
            >
              {/* header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerLamp}>
                    <Image source={TIMOTEO_IMG} style={styles.headerImg} contentFit="cover" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Timoteo</Text>
                    <Text style={styles.headerSub}>La tua guida nella piattaforma</Text>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  {messages.length > 1 && (
                    <Pressable testID="timoteo-reset" onPress={resetChat} hitSlop={10} style={styles.resetBtn}>
                      <Ionicons name="create-outline" size={22} color={colors.muted} />
                    </Pressable>
                  )}
                  <Pressable testID="timoteo-close" onPress={() => setOpen(false)} hitSlop={12} style={styles.resetBtn}>
                    <Ionicons name="close" size={26} color={colors.onSurface} />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.md }}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((m, i) => (
                  <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowRight : styles.rowLeft]}>
                    <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble]}>
                      <Text style={m.role === "user" ? styles.userText : styles.botText}>{m.content}</Text>
                      {!!m.actions?.length && (
                        <View style={styles.actionsWrap}>
                          {m.actions.map((a, j) => (
                            <Pressable key={j} testID={`timoteo-action-${i}-${j}`} onPress={() => runAction(a)} style={styles.actionBtn}>
                              <Text style={styles.actionText} numberOfLines={1}>{a.label}</Text>
                              <Ionicons name="chevron-forward" size={15} color={colors.brandPrimary} />
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                {showSuggestions && (
                  <View style={styles.suggWrap}>
                    {QUICK.map((q) => (
                      <Pressable key={q.label} testID={`timoteo-quick-${q.label}`} onPress={() => send(q.prompt)} style={styles.chip}>
                        <Text style={styles.chipText}>{q.icon}  {q.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {loading && !streamingNow && (
                  <View style={[styles.bubbleRow, styles.rowLeft]}>
                    <View style={[styles.bubble, styles.botBubble, styles.typing]}>
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                      <Text style={styles.typingText}>Timoteo sta scrivendo…</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* input */}
              <View style={styles.inputBar}>
                <TextInput
                  testID="timoteo-input"
                  value={input}
                  onChangeText={setInput}
                  placeholder="Scrivi a Timoteo…"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  onSubmitEditing={() => send(input)}
                  returnKeyType="send"
                  multiline
                />
                <Pressable
                  testID="timoteo-send"
                  onPress={() => send(input)}
                  disabled={!input.trim() || loading}
                  style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
                >
                  <Ionicons name="arrow-up" size={20} color={colors.white} />
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: "absolute", left: 0, zIndex: 50,
    backgroundColor: "#0B2A4A", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 10, paddingHorizontal: 6, width: 42,
    borderTopRightRadius: 16, borderBottomRightRadius: 16,
    borderWidth: 1, borderLeftWidth: 0, borderColor: "rgba(255,255,255,0.25)",
    shadowColor: colors.navy, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  tabImg: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
  tabText: {
    color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 1,
    transform: [{ rotate: "90deg" }], marginTop: 14, width: 60, textAlign: "center",
  },

  overlayRoot: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 100, elevation: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,17,40,0.45)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    height: "88%", backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resetBtn: { padding: 2 },
  headerLamp: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: "#0B2A4A" },
  headerLampGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerImg: { width: "100%", height: "100%" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  bubbleRow: { marginBottom: spacing.md, flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "86%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.lg },
  botBubble: { backgroundColor: colors.surfaceTertiary, borderTopLeftRadius: 4 },
  userBubble: { backgroundColor: colors.brandPrimary, borderTopRightRadius: 4 },
  botText: { color: colors.onSurface, fontSize: 15, lineHeight: 21 },
  userText: { color: colors.white, fontSize: 15, lineHeight: 21 },

  actionsWrap: { marginTop: spacing.sm, gap: 6 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brandTertiary,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  actionText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 14, flex: 1, marginRight: 6 },

  suggWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 9, borderWidth: 1, borderColor: colors.border,
  },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },

  typing: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { color: colors.muted, fontSize: 13 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15, color: colors.onSurface,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { backgroundColor: colors.borderStrong },
});
