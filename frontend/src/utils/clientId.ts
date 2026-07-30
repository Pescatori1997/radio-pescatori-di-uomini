import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pdu_client_id";

/** Stable per-install identifier used to let guests interact (e.g. "Sto pregando")
 * only once per device without requiring an account. */
export async function getClientId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev_${Math.random().toString(36).slice(2, 10)}`;
  }
}
