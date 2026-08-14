import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSettings } from "@/src/context/SettingsContext";
import { mediaUrl } from "@/src/api";

export type IconFamily = "ion" | "mci";

export type NavCatalogItem = {
  key: string;
  label: string;
  route: string;
  family?: IconFamily;                     // vector icon family (default: ion)
  icon: string;                            // outline (inactive)
  iconOn: string;                          // filled (active)
};

/** A single uploaded asset stored in settings.nav_config[key]. */
export type NavAsset = { id: string; kind?: "lottie" | "raster"; mime?: string; filename?: string } | null;

/** Per-item customization stored under settings.nav_config[key]. */
export type NavItemConfig = {
  label?: string;
  color?: string;          // inactive icon color
  colorActive?: string;    // active icon color
  indicator?: boolean;     // show wave under active icon (default true)
  icon?: NavAsset;         // custom static inactive icon (image)
  iconActive?: NavAsset;   // custom static active icon (image)
  anim?: NavAsset;         // animation played once on selection
};

/** Fully resolved nav item (catalog defaults merged with admin overrides). */
export type ResolvedNavItem = NavCatalogItem & {
  colorInactive?: string;
  colorActive?: string;
  indicator: boolean;
  iconUrl?: string;
  iconActiveUrl?: string;
  animUrl?: string;
  animKind?: "lottie" | "raster";
};

/** Every section that can be placed in the bottom navigation bar. The admin
 * picks/reorders a subset of these keys (settings.nav_items) and can further
 * customize each one (label, colors, custom icons, animation) via nav_config. */
export const NAV_CATALOG: NavCatalogItem[] = [
  { key: "index",       label: "Home",        route: "/",              family: "mci", icon: "lighthouse",                 iconOn: "lighthouse-on" },
  { key: "podcast",     label: "Podcast",     route: "/podcast",       family: "ion", icon: "mic-outline",                iconOn: "mic" },
  { key: "meditazioni", label: "Meditazioni", route: "/meditazioni",   family: "ion", icon: "book-outline",               iconOn: "book" },
  { key: "news",        label: "Notizie",     route: "/news",          family: "ion", icon: "newspaper-outline",          iconOn: "newspaper" },
  { key: "palinsesto",  label: "Palinsesto",  route: "/palinsesto",    family: "ion", icon: "calendar-outline",           iconOn: "calendar" },
  { key: "bibbia",      label: "Bibbia",      route: "/lettore",       family: "ion", icon: "book-outline",               iconOn: "book" },
  { key: "piani",       label: "Piani",       route: "/lettore/piani", family: "ion", icon: "list-outline",               iconOn: "list" },
  { key: "preghiera",   label: "Preghiera",   route: "/prayer",        family: "ion", icon: "heart-outline",              iconOn: "heart" },
  { key: "donazioni",   label: "Sostieni",    route: "/donate",        family: "ion", icon: "gift-outline",               iconOn: "gift" },
  { key: "vetrina",     label: "Negozio",     route: "/merch",         family: "ion", icon: "bag-handle-outline",         iconOn: "bag-handle" },
  { key: "traguardi",   label: "Traguardi",   route: "/traguardi",     family: "ion", icon: "trophy-outline",             iconOn: "trophy" },
  { key: "chisiamo",    label: "Chi siamo",   route: "/about",         family: "ion", icon: "information-circle-outline",  iconOn: "information-circle" },
  { key: "contatti",    label: "Contatti",    route: "/contact",       family: "ion", icon: "mail-outline",               iconOn: "mail" },
  { key: "profilo",     label: "Altro",       route: "/profilo",       family: "ion", icon: "menu-outline",               iconOn: "menu" },
];

export const DEFAULT_NAV: string[] = ["index", "podcast", "meditazioni", "news", "palinsesto", "profilo"];

const CATALOG_MAP: Record<string, NavCatalogItem> = Object.fromEntries(NAV_CATALOG.map((i) => [i.key, i]));

function assetUrl(a: NavAsset): string | undefined {
  if (a && a.id) return mediaUrl(a.id);
  return undefined;
}

/** Merge a catalog item with its admin override config into a resolved item. */
export function resolveNavItem(base: NavCatalogItem, cfg?: NavItemConfig): ResolvedNavItem {
  const c = cfg || {};
  return {
    ...base,
    label: (c.label && c.label.trim()) || base.label,
    colorInactive: c.color || undefined,
    colorActive: c.colorActive || undefined,
    indicator: c.indicator !== false,
    iconUrl: assetUrl(c.icon || null),
    iconActiveUrl: assetUrl(c.iconActive || null),
    animUrl: assetUrl(c.anim || null),
    animKind: (c.anim && c.anim.kind) || undefined,
  };
}

/** Resolve the ordered list of nav items configured by the admin. */
export function useNavItems(): ResolvedNavItem[] {
  const { settings } = useSettings();
  const cfgMap: Record<string, NavItemConfig> = (settings?.nav_config as any) || {};
  const keys = Array.isArray(settings?.nav_items) && settings!.nav_items.length ? settings!.nav_items : DEFAULT_NAV;
  const items = keys
    .map((k: string) => (CATALOG_MAP[k] ? resolveNavItem(CATALOG_MAP[k], cfgMap[k]) : null))
    .filter(Boolean) as ResolvedNavItem[];
  return items.length ? items : DEFAULT_NAV.map((k) => resolveNavItem(CATALOG_MAP[k], cfgMap[k]));
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

/** Small helper so both the vector-icon renderer and previews share one source. */
export function VectorIcon({ family, name, size, color }: { family?: IconFamily; name: string; size: number; color: string }) {
  if (family === "mci") return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  return <Ionicons name={name as any} size={size} color={color} />;
}
