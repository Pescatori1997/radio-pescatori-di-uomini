import AsyncStorage from "@react-native-async-storage/async-storage";

export type GreetingMode = "name" | "sibling" | "auto";
export type SiblingTitle = "fratello" | "sorella";

const MODE_KEY = "timoteo_greeting_mode";
const TITLE_KEY = "timoteo_sibling_title";

export async function getGreetingPrefs(): Promise<{ mode: GreetingMode; title: SiblingTitle }> {
  const [mode, title] = await Promise.all([
    AsyncStorage.getItem(MODE_KEY),
    AsyncStorage.getItem(TITLE_KEY),
  ]);
  return {
    mode: (mode as GreetingMode) || "auto",
    title: (title as SiblingTitle) || "fratello",
  };
}

export async function setGreetingMode(mode: GreetingMode) {
  await AsyncStorage.setItem(MODE_KEY, mode);
}

export async function setSiblingTitle(title: SiblingTitle) {
  await AsyncStorage.setItem(TITLE_KEY, title);
}

/** First name only, trimmed. */
function firstName(name?: string | null): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

/** Build the personalized opening line for Timoteo. */
export function buildGreeting(name: string | null | undefined, mode: GreetingMode, title: SiblingTitle): string {
  const fn = firstName(name);
  if (!fn) return "Ciao!";
  if (mode === "sibling") return `Ciao ${title} ${fn}.`;
  return `Ciao ${fn}!`; // "name" and "auto" both greet by name when available
}
