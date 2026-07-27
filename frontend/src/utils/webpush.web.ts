// Web Push (VAPID) for the installed PWA. Registers the browser PushSubscription
// with the backend so the admin "Invia notifica" / category pushes reach the web app.
import { api } from "@/src/api";

export type WebPushResult = { ok: boolean; reason?: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isWebPushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getWebPushState(): Promise<"unsupported" | "granted" | "denied" | "default"> {
  if (!(await isWebPushSupported())) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}

export async function subscribeWebPush(userId?: string | null): Promise<WebPushResult> {
  try {
    if (!(await isWebPushSupported())) return { ok: false, reason: "unsupported" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: permission };

    const reg = await navigator.serviceWorker.ready;
    const { public_key } = await api.webpushPublicKey();
    if (!public_key) return { ok: false, reason: "no-key" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });
    }

    await api.webpushSubscribe({ user_id: userId || null, subscription: sub.toJSON() });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "error" };
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  try {
    if (!(await isWebPushSupported())) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.webpushUnsubscribe({ subscription: sub.toJSON() });
      await sub.unsubscribe();
    }
  } catch {}
}
