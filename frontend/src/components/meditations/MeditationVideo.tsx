import React, { useEffect, useRef } from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

/**
 * Native fullscreen (TikTok-style) video for the continuous meditation player.
 * Uses expo-video so muted autoplay works reliably on iOS/Android/web without a
 * manual play tap. Audio stays off until the first tap (OS rule); subsequent
 * taps toggle play/pause. Only the active card plays.
 *
 * Autoplay is triggered on the `readyToPlay` status (not in the setup callback)
 * because the underlying video view isn't mounted yet during setup — this is
 * the reliable pattern for muted autoplay across web and native.
 */
export default function MeditationVideo({
  uri, active,
}: { uri: string; active: boolean; poster?: string }) {
  const unmuted = useRef(false);
  const activeRef = useRef(active);

  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("statusChange", ({ status }: any) => {
      if (status === "readyToPlay") {
        try {
          player.muted = !unmuted.current;
          if (activeRef.current) player.play();
        } catch { /* ignore */ }
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    activeRef.current = active;
    if (!player) return;
    try {
      player.muted = !unmuted.current;
      if (active) player.play();
      else player.pause();
    } catch { /* player may be released */ }
  }, [active, player]);

  const onTap = () => {
    try {
      if (player.muted) { unmuted.current = true; player.muted = false; player.play(); }
      else if (!player.playing) player.play();
      else player.pause();
    } catch { /* ignore */ }
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
      <View style={styles.bg} />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
});
