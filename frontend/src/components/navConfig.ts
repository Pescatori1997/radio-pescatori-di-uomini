import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/src/context/SettingsContext";

export type NavCatalogItem = {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;   // outline (inactive)
  iconOn: keyof typeof Ionicons.glyphMap;  // filled (active)
};

/** Every section that can be placed in the bottom navigation bar. The admin
 * picks/reorders a subset of these keys (settings.nav_items). */
export const NAV_CATALOG: NavCatalogItem[] = [
  { key: "index",       label: "Home",        route: "/",              icon: "home-outline",               iconOn: "home" },
  { key: "podcast",     label: "Podcast",     route: "/podcast",       icon: "mic-outline",                iconOn: "mic" },
  { key: "meditazioni", label: "Meditazioni", route: "/meditazioni",   icon: "book-outline",               iconOn: "book" },
  { key: "news",        label: "Notizie",     route: "/news",          icon: "newspaper-outline",          iconOn: "newspaper" },
  { key: "palinsesto",  label: "Palinsesto",  route: "/palinsesto",    icon: "calendar-outline",           iconOn: "calendar" },
  { key: "bibbia",      label: "Bibbia",      route: "/lettore",       icon: "book-outline",               iconOn: "book" },
  { key: "piani",       label: "Piani",       route: "/lettore/piani", icon: "list-outline",               iconOn: "list" },
  { key: "preghiera",   label: "Preghiera",   route: "/prayer",        icon: "heart-outline",              iconOn: "heart" },
  { key: "donazioni",   label: "Sostieni",    route: "/donate",        icon: "gift-outline",               iconOn: "gift" },
  { key: "vetrina",     label: "Negozio",     route: "/merch",         icon: "bag-handle-outline",         iconOn: "bag-handle" },
  { key: "traguardi",   label: "Traguardi",   route: "/traguardi",     icon: "trophy-outline",             iconOn: "trophy" },
  { key: "chisiamo",    label: "Chi siamo",   route: "/about",         icon: "information-circle-outline",  iconOn: "information-circle" },
  { key: "contatti",    label: "Contatti",    route: "/contact",       icon: "mail-outline",               iconOn: "mail" },
  { key: "profilo",     label: "Altro",       route: "/profilo",       icon: "menu-outline",               iconOn: "menu" },
];

export const DEFAULT_NAV: string[] = ["index", "podcast", "meditazioni", "news", "palinsesto", "profilo"];

const CATALOG_MAP: Record<string, NavCatalogItem> = Object.fromEntries(NAV_CATALOG.map((i) => [i.key, i]));

/** Resolve the ordered list of nav items configured by the admin. */
export function useNavItems(): NavCatalogItem[] {
  const { settings } = useSettings();
  const keys = Array.isArray(settings?.nav_items) && settings!.nav_items.length ? settings!.nav_items : DEFAULT_NAV;
  const items = keys.map((k: string) => CATALOG_MAP[k]).filter(Boolean) as NavCatalogItem[];
  return items.length ? items : DEFAULT_NAV.map((k) => CATALOG_MAP[k]);
}

/** Which catalog key matches the current pathname (for active highlighting). */
export function activeKeyForPath(pathname: string, items: NavCatalogItem[]): string | null {
  if (pathname === "/" || pathname === "/index") return items.some((i) => i.key === "index") ? "index" : null;
  let best: { key: string; len: number } | null = null;
  for (const it of items) {
    if (it.route === "/") continue;
    if (pathname === it.route || pathname.startsWith(it.route + "/")) {
      if (!best || it.route.length > best.len) best = { key: it.key, len: it.route.length };
    }
  }
  return best?.key ?? null;
}
