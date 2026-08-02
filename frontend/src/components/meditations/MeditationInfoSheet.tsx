import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

/**
 * Bottom sheet that shows the full meditation description (+ title, speaker,
 * verse). Slides up over the still-playing video; tapping the backdrop or the
 * close button dismisses it. The player behind is never unmounted.
 */
export default function MeditationInfoSheet({
  item, onClose,
}: { item: any; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetH = Math.min(height * 0.62, height - insets.top - 40);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [slide]);

  const close = () => {
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] });
  const backdrop = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const hasDesc = !!(item?.description && String(item.description).trim());

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: backdrop }]}>
        <Pressable testID="med-info-backdrop" style={{ flex: 1 }} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: sheetH, paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.kicker}>Dettagli meditazione</Text>
          <Pressable testID="med-info-close" onPress={close} hitSlop={12}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{item?.title}</Text>
          {!!item?.speaker && (
            <View style={styles.metaRow}><Ionicons name="mic-outline" size={16} color={colors.brandPrimary} /><Text style={styles.meta}>{item.speaker}</Text></View>
          )}
          {!!item?.category && (
            <View style={styles.metaRow}><Ionicons name="pricetag-outline" size={16} color={colors.brandPrimary} /><Text style={styles.meta}>{item.category}</Text></View>
          )}
          {!!item?.verse && (
            <View style={styles.verseBox}><Text style={styles.verse}>“{item.verse}”</Text></View>
          )}
          {hasDesc ? (
            <Text style={styles.desc}>{item.description}</Text>
          ) : (
            <Text style={styles.empty}>Nessuna descrizione disponibile per questa meditazione.</Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  verseBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.brandPrimary },
  verse: { color: colors.onSurface, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  desc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24 },
  empty: { color: colors.onSurfaceTertiary, fontSize: 14, fontStyle: "italic" },
});
