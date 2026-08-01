import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, FlatList, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

function fmt(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }); } catch { return ""; }
}

/** Read + write comments for a meditation. Consistent with the app design
 * (surface bottom-sheet), not a TikTok-style overlay. */
export default function MeditationComments({
  mid, visible, onClose, onPosted,
}: { mid: string; visible: boolean; onClose: () => void; onPosted?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    if (!mid) return;
    setLoading(true);
    api.meditationComments(mid).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [mid]);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const c = await api.meditationComment(mid, t);
      setItems((p) => [c, ...p]);
      setText("");
      onPosted?.();
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Commenti</Text>
              <Pressable testID="med-comments-close" onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
            </View>

            {loading ? (
              <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
            ) : items.length === 0 ? (
              <View style={styles.center}><Text style={styles.empty}>Nessun commento. Scrivi il primo!</Text></View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(i) => i.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || "U")[0].toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentHead}>
                        <Text style={styles.commentName}>{item.name}</Text>
                        <Text style={styles.commentDate}>{fmt(item.created_at)}</Text>
                      </View>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            {user ? (
              <View style={styles.inputBar}>
                <TextInput
                  testID="med-comment-input"
                  value={text} onChangeText={setText}
                  placeholder="Scrivi un commento…" placeholderTextColor={colors.muted}
                  style={styles.input} multiline
                />
                <Pressable testID="med-comment-send" onPress={send} disabled={!text.trim() || sending}
                  style={[styles.sendBtn, (!text.trim() || sending) && styles.sendOff]}>
                  <Ionicons name="send" size={18} color={colors.white} />
                </Pressable>
              </View>
            ) : (
              <Pressable testID="med-comment-login" onPress={() => { onClose(); router.push("/login?mode=register"); }} style={styles.loginBar}>
                <Text style={styles.loginText}>Accedi per commentare</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,17,40,0.45)", justifyContent: "flex-end" },
  sheetWrap: { justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: "72%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, fontSize: 14 },
  commentRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  commentName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  commentDate: { color: colors.onSurfaceTertiary, fontSize: 12 },
  commentText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.onSurface, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  sendOff: { backgroundColor: colors.borderStrong },
  loginBar: { padding: spacing.lg, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border },
  loginText: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
});
