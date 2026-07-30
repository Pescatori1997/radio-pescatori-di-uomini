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

/**
 * Capture the referenced card and open the native share sheet.
 * - Native: expo-sharing (WhatsApp, Telegram, Instagram, Mail, ...). If sharing
 *   is unavailable, the image is saved to the gallery as a fallback.
 * - Web: Web Share API with file support, falling back to an automatic download.
 */
export async function shareCard(cardRef: any, opts: {
  filename: string;
  message?: string;
  captureSize?: CaptureOpts;
}): Promise<void> {
  const { filename, message = "", captureSize } = opts;
  const uri = await capture(cardRef, captureSize);

  if (Platform.OS === "web") {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const file = new File([blob], filename, { type: "image/png" });
    const nav: any = navigator;
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text: message });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: message || "Condividi" });
  } else {
    // Device can't present a share sheet -> save the card to the gallery instead.
    await saveCard(cardRef, { captureSize, silent: false, preUri: uri });
  }
}

/**
 * Capture and save the card image to the device gallery (native) or download it
 * (web). Handles the media-library permission flow.
 */
export async function saveCard(cardRef: any, opts: {
  captureSize?: CaptureOpts;
  silent?: boolean;
  preUri?: string;
} = {}): Promise<void> {
  const { captureSize, silent, preUri } = opts;

  if (Platform.OS === "web") {
    const uri = preUri || (await capture(cardRef, captureSize));
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pescatori-di-uomini.png";
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }

  // Native: request permission contextually (only when the user taps "Salva").
  const cur = await MediaLibrary.getPermissionsAsync();
  let status = cur.status;
  if (status !== "granted" && cur.canAskAgain) {
    status = (await MediaLibrary.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    alertMessage(
      "Permesso necessario",
      "Consenti l'accesso alle foto per salvare la card. Puoi abilitarlo dalle impostazioni del dispositivo.",
    );
    return;
  }
  const uri = preUri || (await capture(cardRef, captureSize));
  await MediaLibrary.saveToLibraryAsync(uri);
  if (!silent) alertMessage("Salvata", "La card è stata salvata nella tua galleria.");
}
