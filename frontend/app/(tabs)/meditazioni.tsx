import React from "react";
import ContinuousMeditationPlayer from "@/src/components/meditations/ContinuousMeditationPlayer";

// The Meditazioni tab opens STRAIGHT into the fullscreen vertical player:
// the videos appear immediately, swipe up/down to move between meditations.
export default function MeditazioniTab() {
  return <ContinuousMeditationPlayer isTab />;
}
