import React, { useEffect, useRef } from "react";
import { getSoundOn, setSoundOn } from "./soundPref";

/**
 * Web implementation of the fullscreen meditation video. react-native-webview's
 * web shim strips <video> autoplay/muted attributes and expo-video's web player
 * keeps the DOM element unmuted (browsers then block autoplay). Rendering a real
 * DOM <video autoplay muted playsinline loop> is the reliable way to get muted
 * autoplay in the browser.
 *
 * Audio: starts muted so autoplay works. The FIRST tap enables sound globally
 * (see soundPref) — from then on every next meditation plays with sound already
 * on, no extra tap needed. Subsequent taps toggle play/pause.
 */
export default function MeditationVideo({
  uri, active, poster,
}: { uri: string; active: boolean; poster?: string }) {
  const ref = useRef<any>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !getSoundOn();
    if (!active) { v.pause(); return; }
    let tries = 0;
    let timer: any;
    const go = () => {
      if (!ref.current) return;
      ref.current.muted = !getSoundOn();
      const p = ref.current.play();
      if (p && p.then) {
        p.catch(() => {
          // If sound-on autoplay was blocked, fall back to muted autoplay so the
          // video still moves, then keep retrying.
          if (ref.current && !ref.current.muted) ref.current.muted = true;
          if (tries++ < 12) timer = setTimeout(go, 300);
        });
      }
    };
    go();
    return () => { if (timer) clearTimeout(timer); };
  }, [active]);

  const onClick = () => {
    const v = ref.current;
    if (!v) return;
    if (v.muted) { setSoundOn(true); v.muted = false; v.play(); }
    else if (v.paused) v.play();
    else v.pause();
  };

  return React.createElement("video" as any, {
    ref,
    "data-testid": "med-player",
    src: uri,
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: "auto",
    poster: poster || undefined,
    onClick,
    style: {
      position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      objectFit: "cover", background: "#000", cursor: "pointer",
    },
  });
}
