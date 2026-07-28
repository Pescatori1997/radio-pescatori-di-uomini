import React from "react";
import { View, Text, StyleSheet, TextInput, Switch } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { useThumbAspect } from "@/src/hooks/useThumbAspect";
import { colors, spacing, radius } from "@/src/theme";

export function AInput({ label, value, onChangeText, multiline, keyboardType, placeholder, testID }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} value={value ?? ""} onChangeText={onChangeText} multiline={multiline} keyboardType={keyboardType}
        placeholder={placeholder} placeholderTextColor={ADMIN.muted}
        style={[styles.input, multiline && { height: 110, textAlignVertical: "top" }]} />
    </View>
  );
}

export function ASwitch({ label, value, onValueChange, testID }: any) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.label}>{label}</Text>
      <Switch testID={testID} value={!!value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary }} />
    </View>
  );
}

export function AImagePicker({ label, value, onChange, testID, aspect = [1, 1] as [number, number] }: any) {
  const thumbAspect = useThumbAspect();
  const pick = async () => {
    const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
    let st = cur.status;
    if (st !== "granted" && cur.canAskAgain) st = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (st !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect, quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) onChange(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale testID={testID} onPress={pick} style={[styles.imgBox, { aspectRatio: thumbAspect }]}>
        {value ? <Image source={{ uri: value }} style={styles.img} contentFit="cover" /> : (
          <View style={styles.imgEmpty}><Ionicons name="image" size={26} color={colors.brandPrimary} /><Text style={styles.imgText}>Carica immagine</Text></View>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md, paddingVertical: 4 },
  imgBox: { width: "100%", borderRadius: radius.md, overflow: "hidden", backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderStyle: "dashed" },
  img: { width: "100%", height: "100%" },
  imgEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  imgText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
});
