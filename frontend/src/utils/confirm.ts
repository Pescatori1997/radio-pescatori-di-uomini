import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog.
 * On native uses Alert.alert; on web uses window.confirm (React Native Web's Alert.alert is a no-op).
 * Resolves true when the user confirms.
 */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = "Conferma",
  destructive = false
): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.confirm) return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

/** Cross-platform info message (native Alert / web window.alert). */
export function alertMessage(title: string, message?: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.alert) window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
