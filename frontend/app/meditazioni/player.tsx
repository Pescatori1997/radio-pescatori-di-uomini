import React from "react";
import { useLocalSearchParams } from "expo-router";
import ContinuousMeditationPlayer from "@/src/components/meditations/ContinuousMeditationPlayer";

// Deep-link entry (e.g. from Timoteo/notifications) — opens the continuous
// fullscreen player starting from a specific meditation, with a back control.
export default function MeditationsPlayerRoute() {
  const { start, q, cat } = useLocalSearchParams<{ start?: string; q?: string; cat?: string }>();
  return <ContinuousMeditationPlayer startId={start} q={q} cat={cat} showBack />;
}
