import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { mediaUrl } from "@/src/api";
import { embedSrc } from "@/src/utils/embeds";

function pageHtml(inner: string, fill: boolean) {
  const fit = fill ? "cover" : "contain";
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#000;height:100%;width:100%;overflow:hidden}.w{position:relative;width:100%;height:100%}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}video{position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};border:0}audio{position:static;width:90%;margin:12px auto;display:block}</style></head><body><div class="w">${inner}</div></body></html>`;
}

// Tap-to-control script for the fullscreen (TikTok-style) player: first tap
// unmutes, next taps toggle play/pause. Keeps a native-app feel without chrome.
const TAP_JS = `<script>(function(){var v=document.getElementById('v');if(!v)return;document.body.addEventListener('click',function(){if(v.muted){v.muted=false;v.play();}else if(v.paused){v.play();}else{v.pause();}});})();</script>`;

// Forces muted autoplay on load (only injected for the ACTIVE card). Retries a
// few times because iOS/WebView can reject the first play() call. Audio stays
// off until the user taps (OS rule), handled by TAP_JS.
const AUTOPLAY_JS = `<script>(function(){var v=document.getElementById('v');if(!v)return;v.muted=true;v.setAttribute('muted','');v.setAttribute('playsinline','');var n=0;var go=function(){var p=v.play();if(p&&p.catch){p.catch(function(){if(n++<10)setTimeout(go,300);});}};go();v.addEventListener('canplay',go);})();</script>`;

function withAutoplay(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}autoplay=1&mute=1&muted=1&playsinline=1`;
}

/**
 * Renders meditation media inside a WebView (user never leaves the app).
 * - `fill` = fullscreen vertical (TikTok-like) with object-fit: cover, no chrome,
 *   autoplay muted + loop, tap to unmute / play-pause.
 * - default = classic contained player with native controls.
 * The WebView is keyed on `active` so it remounts when a card gains/loses focus,
 * reliably stopping audio on swipe (no overlapping streams).
 */
export default function MeditationPlayer({
  m, active = true, autoplay = false, fill = false,
}: { m: any; active?: boolean; autoplay?: boolean; fill?: boolean }) {
  let html: string | null = null;
  let uri: string | null = null;
  const auto = active && autoplay;
  const vAttrs = `playsinline webkit-playsinline ${auto ? "autoplay muted" : ""} ${fill ? "loop" : "controls"}`;

  if (m?.media_id && m?.media_type === "video") {
    html = pageHtml(`<video id="v" src="${mediaUrl(m.media_id)}" ${m.thumbnail ? `poster="${m.thumbnail}"` : ""} ${vAttrs}></video>${fill ? TAP_JS : ""}${fill && auto ? AUTOPLAY_JS : ""}`, fill);
  } else if (m?.media_id && m?.media_type === "audio") {
    html = pageHtml(`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0A1128"><audio src="${mediaUrl(m.media_id)}" controls ${auto ? "autoplay" : ""}></audio></div>`, fill);
  } else if (m?.media_id && m?.media_type === "pdf") {
    uri = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(mediaUrl(m.media_id))}`;
  } else {
    const src = embedSrc(m?.video_url || "", m?.provider);
    if (src) uri = auto ? withAutoplay(src) : src;
    else if (m?.video_url) html = pageHtml(`<video id="v" src="${m.video_url}" ${vAttrs}></video>${fill ? TAP_JS : ""}${fill && auto ? AUTOPLAY_JS : ""}`, fill);
  }

  if (!html && !uri) {
    return <View style={styles.empty}><Text style={styles.emptyText}>Contenuto non disponibile</Text></View>;
  }

  // On native (iOS/Android) some WebViews ignore the HTML `autoplay` attribute;
  // this injected script keeps calling muted play() until it succeeds so the
  // active card starts automatically. Audio stays off until the user taps.
  const playJS = fill && auto
    ? `(function(){function go(){var v=document.getElementById('v');if(v){v.muted=true;v.setAttribute('muted','');var p=v.play();if(p&&p.then){p.then(function(){window.__pl=1;}).catch(function(){});}}}var t=setInterval(function(){if(window.__pl){clearInterval(t);}else{go();}},250);go();setTimeout(function(){clearInterval(t);},8000);})();true;`
    : undefined;

  return (
    <WebView
      key={`${m?.id}-${active ? "on" : "off"}`}
      testID="med-player"
      source={html ? { html } : { uri: uri! }}
      style={styles.webview}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      mediaPlaybackRequiresUserAction={false}
      injectedJavaScript={playJS}
      originWhitelist={["*"]}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#000" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  emptyText: { color: "#94A3B8", fontSize: 13 },
});
