import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { alertMessage } from "@/src/utils/confirm";

/** Base URL used to build direct links inside shared content. On web we use the
 * current origin; on native we fall back to the configured public site URL so a
 * shared link opens the site (and invites to install the app) when tapped. */
export function siteBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
}

type CaptureOpts = { width?: number; height?: number };

async function capture(cardRef: any, opts: CaptureOpts = {}): Promise<string> {
  return captureRef(cardRef, { format: "png", quality: 1, ...opts });
}

/** Web only: capture the card into a File object so the native share sheet can be
 * invoked directly from the click handler (preserving the user-activation that
 * iOS Safari requires). Uses html2canvas directly on the DOM node because
 * react-native-view-shot's captureRef relies on findNodeHandle, which is not
 * supported on modern react-native-web. */
async function captureWebFile(cardRef: any, filename: string): Promise<File> {
  const node = cardRef?.current as any;
  if (!node) throw new Error("card node not ready");
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, { backgroundColor: null, useCORS: true, scale: 2, logging: false });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
  return new File([blob], filename, { type: "image/png" });
}

function downloadWebFile(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name || "pescatori-di-uomini.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function saveNative(cardRef: any, captureSize?: CaptureOpts, preUri?: string, silent = false): Promise<void> {
  const cur = await MediaLibrary.getPermissionsAsync();
  let status = cur.status;
  if (status !== "granted" && cur.canAskAgain) status = (await MediaLibrary.requestPermissionsAsync()).status;
  if (status !== "granted") {
    alertMessage("Permesso necessario", "Consenti l'accesso alle foto per salvare la card. Puoi abilitarlo dalle impostazioni del dispositivo.");
    return;
  }
  const uri = preUri || (await capture(cardRef, captureSize));
  await MediaLibrary.saveToLibraryAsync(uri);
  if (!silent) alertMessage("Salvata", "La card è stata salvata nella tua galleria.");
}

/**
 * Hook that wires up "Condividi" + "Salva/Scarica" for a captured card.
 * On web it PRE-CAPTURES the image when the sheet opens, then calls
 * navigator.share() directly on tap (so iOS Safari keeps the user gesture).
 */
export function useShareCard(cardRef: any, opts: {
  visible: boolean;
  filename: string;
  message?: string;
  captureSize?: CaptureOpts;
}) {
  const { visible, filename, message = "", captureSize } = opts;
  const [file, setFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-capture on web once the modal is visible (allow a beat for layout).
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) { setFile(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const f = await captureWebFile(cardRef, filename);
        if (!cancelled) setFile(f);
      } catch { /* ignore; onShare will retry */ }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [visible, filename]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShare = async () => {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : {};
      // Fast path: prepared file + Web Share API -> call share() immediately (no prior await).
      if (file && nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        try {
          await nav.share({ files: [file], text: message });
        } catch (e: any) {
          if (e && e.name === "AbortError") return; // user cancelled
          try { downloadWebFile(file); } catch { /* ignore */ }
        }
        return;
      }
      // Fallback: capture (if needed) then either share text or download the image.
      setSharing(true);
      try {
        const f = file || (await captureWebFile(cardRef, filename));
        if (nav.share && (!nav.canShare || nav.canShare({ files: [f] }))) {
          await nav.share({ files: [f], text: message }).catch(() => downloadWebFile(f));
        } else {
          downloadWebFile(f);
        }
      } catch {
        alertMessage("Condivisione non riuscita", "Riprova o usa il pulsante Scarica.");
      } finally {
        setSharing(false);
      }
      return;
    }

    // Native: expo-sharing (share sheet). Falls back to gallery save if unavailable.
    setSharing(true);
    try {
      const uri = await capture(cardRef, captureSize);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: message || "Condividi" });
      } else {
        await saveNative(cardRef, captureSize, uri);
      }
    } catch { /* cancelled */ } finally { setSharing(false); }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      if (Platform.OS === "web") {
        const f = file || (await captureWebFile(cardRef, filename));
        downloadWebFile(f);
      } else {
        await saveNative(cardRef, captureSize);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  // On web the Condividi button waits until the pre-capture is ready.
  const ready = Platform.OS !== "web" || !!file;
  return { onShare, onSave, sharing, saving, ready };
}
