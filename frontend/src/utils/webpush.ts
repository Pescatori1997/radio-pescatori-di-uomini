// Native no-op. Web Push (VAPID) is a browser-only feature; the real
// implementation lives in webpush.web.ts. On iOS/Android native builds the
// app uses expo-notifications (src/utils/push.ts) instead.
export type WebPushResult = { ok: boolean; reason?: string };

export async function isWebPushSupported(): Promise<boolean> {
  return false;
}

export async function getWebPushState(): Promise<"unsupported" | "granted" | "denied" | "default">
{
  return "unsupported";
}

export async function subscribeWebPush(_userId?: string | null): Promise<WebPushResult> {
  return { ok: false, reason: "unsupported" };
}

export async function unsubscribeWebPush(): Promise<void> {}
