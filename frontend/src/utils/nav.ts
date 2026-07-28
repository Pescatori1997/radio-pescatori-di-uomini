import { router } from "expo-router";

/**
 * Back navigation that never dead-ends. If there is history (normal in-app
 * navigation) it pops the current screen; otherwise — e.g. a screen opened
 * directly from a push notification deep-link, where no stack exists — it
 * falls back to the Home tab so the back arrow always works.
 *
 * Behaves identically on Android, iOS, the web PWA and the installed app.
 */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
