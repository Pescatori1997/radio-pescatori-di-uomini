import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { colors, spacing } from "@/src/theme";

export default function Collaborators({ title = "I nostri collaboratori" }: { title?: string }) {
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    api.collaborators().then(setTeam).catch(() => {});
  }, []);

  if (team.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.xl }} testID="collaborators-section">
      <Text style={styles.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {team.map((c) => (
          <View key={c.id} testID={`collaborator-${c.id}`} style={styles.card}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: c.photo }} style={styles.avatar} contentFit="cover" />
            </View>
            <Text numberOfLines={1} style={styles.name}>{c.name}</Text>
            <Text numberOfLines={2} style={styles.role}>{c.role}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  card: { width: 104, alignItems: "center" },
  avatarRing: { width: 92, height: 92, borderRadius: 46, padding: 3, borderWidth: 2, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.surfaceTertiary },
  name: { fontSize: 14, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm, textAlign: "center" },
  role: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 2, textAlign: "center", lineHeight: 16 },
});
