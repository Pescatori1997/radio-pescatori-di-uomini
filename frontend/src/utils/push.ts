import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api";

/**
 * Register the device for push notifications and send the native token to the backend.
 * Native-only (Expo Go/web unsupported). Never throws — failures are logged and ignored so
 * they can never block the auth/app flow.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.registerPush({
      user_id: userId,
      platform: Platform.OS,
      device_token: String(tokenResp.data),
    });
  } catch (e) {
    console.log("registerForPush skipped:", (e as Error)?.message);
  }
}
