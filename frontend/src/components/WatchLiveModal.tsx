import React from "react";
import { View, Text, StyleSheet, Modal, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PressableScale from "@/src/components/PressableScale";
import { configuredPlatforms } from "@/src/livePlatforms";
import { colors, spacing, radius } from "@/src/theme";

export default function WatchLiveModal({
  visible,
  links,
  onClose,
}: {
  visible: boolean;
  links?: Record<string, string> | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const platforms = configuredPlatforms(links);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Dove vuoi guardare la diretta?</Text>
          <Text style={styles.sub}>Scegli una piattaforma</Text>

          {platforms.map((p) => (
            <PressableScale key={p.key} testID={`watch-platform-${p.key}`} style={styles.row} onPress={() => open(p.url)}>
              <View style={[styles.iconBadge, { backgroundColor: p.color === "#000000" ? "#111827" : p.color }]}>
                <Ionicons name={p.icon as any} size={22} color={colors.white} />
              </View>
              <Text style={styles.rowLabel}>{p.label}</Text>
              <Ionicons name="open-outline" size={20} color={colors.muted} />
            </PressableScale>
          ))}

          <Pressable testID="watch-cancel" style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Annulla</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  sub: { color: colors.onSurfaceSecondary, fontSize: 14, textAlign: "center", marginTop: 4, marginBottom: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  iconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  cancel: { marginTop: spacing.sm, paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "700" },
});
