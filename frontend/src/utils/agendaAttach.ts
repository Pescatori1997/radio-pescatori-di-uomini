import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Linking } from "react-native";

export type PickedAttachment = { name: string; kind: "image" | "pdf" | "file"; url: string; size: number };

async function uriToDataUrl(uri: string, mime: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mime};base64,${b64}`;
}

export async function pickImageAttachment(): Promise<PickedAttachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const url = a.base64 ? `data:image/jpeg;base64,${a.base64}` : await uriToDataUrl(a.uri, "image/jpeg");
  return { name: a.fileName || "immagine.jpg", kind: "image", url, size: a.fileSize || 0 };
}

export async function pickDocumentAttachment(): Promise<PickedAttachment | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "*/*"], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const mime = a.mimeType || "application/octet-stream";
  const url = await uriToDataUrl(a.uri, mime);
  const kind = mime.includes("pdf") ? "pdf" : "file";
  return { name: a.name || "documento", kind, url, size: a.size || 0 };
}

/** Open or download an attachment (http link or data URI). */
export async function openAttachment(att: { url?: string; name?: string; kind?: string }) {
  const url = att.url || "";
  if (!url) return;
  if (url.startsWith("http")) { Linking.openURL(url); return; }
  if (Platform.OS === "web") {
    const w = window.open();
    if (w) w.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100%"></iframe>`);
    return;
  }
  // data URI on native -> write to cache then share
  try {
    const m = url.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return;
    const path = `${FileSystem.cacheDirectory}${(att.name || "file").replace(/[^\w.\-]/g, "_")}`;
    await FileSystem.writeAsStringAsync(path, m[2], { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  } catch { /* ignore */ }
}
