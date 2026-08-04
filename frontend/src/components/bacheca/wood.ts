// Wood presets for the "Traguardi del Cammino" antique cabinet. Each preset is
// a set of layered gradient stops that simulate stained wood with depth. Chosen
// from the Admin panel (walk_board.wood). Kept coherent with the app's navy
// palette so it never looks like a video game.

export type WoodKey = "walnut" | "oak" | "mahogany" | "ebony";

export type WoodTheme = {
  // door / frame face (top-lit)
  frame: [string, string, string];
  // recessed interior backboard
  board: [string, string, string];
  // thin plank grain line color
  grain: string;
  // carved bevel highlight / shadow
  bevelLight: string;
  bevelDark: string;
  // brass hardware
  brass: string;
  brassDark: string;
  // engraved label plaque
  plaque: [string, string];
  plaqueText: string;
};

export const WOODS: Record<WoodKey, WoodTheme> = {
  walnut: {
    frame: ["#6B4327", "#4E2F1B", "#301C10"],
    board: ["#3A2416", "#2A1810", "#1C0F09"],
    grain: "rgba(0,0,0,0.22)",
    bevelLight: "rgba(214,167,120,0.55)",
    bevelDark: "rgba(0,0,0,0.5)",
    brass: "#D9B26A",
    brassDark: "#8A6B32",
    plaque: ["#C9A25E", "#9A7638"],
    plaqueText: "#3A2510",
  },
  oak: {
    frame: ["#A5794A", "#8A6238", "#5F4224"],
    board: ["#6E4E2E", "#573D24", "#3C2A18"],
    grain: "rgba(0,0,0,0.16)",
    bevelLight: "rgba(240,210,160,0.6)",
    bevelDark: "rgba(0,0,0,0.42)",
    brass: "#E0C078",
    brassDark: "#9C7E3E",
    plaque: ["#D9BB7C", "#AE8F4E"],
    plaqueText: "#4A3418",
  },
  mahogany: {
    frame: ["#7A331F", "#5A2415", "#3A160C"],
    board: ["#4A1E12", "#37150C", "#240D07"],
    grain: "rgba(0,0,0,0.24)",
    bevelLight: "rgba(224,150,110,0.5)",
    bevelDark: "rgba(0,0,0,0.5)",
    brass: "#E2B36A",
    brassDark: "#96702F",
    plaque: ["#CDA05C", "#9C7538"],
    plaqueText: "#3A1A0E",
  },
  ebony: {
    frame: ["#3A3A40", "#26262B", "#141418"],
    board: ["#24242A", "#191920", "#0E0E12"],
    grain: "rgba(0,0,0,0.3)",
    bevelLight: "rgba(180,190,210,0.4)",
    bevelDark: "rgba(0,0,0,0.55)",
    brass: "#CBB98A",
    brassDark: "#87764C",
    plaque: ["#B9AC86", "#8C7F58"],
    plaqueText: "#26241A",
  },
};

// Tier metal styling for the medals.
export type Tier = "bronze" | "silver" | "gold" | string;

export const TIERS: Record<string, { ring: [string, string]; edge: string; glow: string; label: string }> = {
  bronze: { ring: ["#E7A56A", "#A5642F"], edge: "#7A421C", glow: "rgba(205,127,50,0.55)", label: "Bronzo" },
  silver: { ring: ["#F2F4F7", "#AEB6C2"], edge: "#7E8794", glow: "rgba(200,210,225,0.6)", label: "Argento" },
  gold: { ring: ["#FCE49A", "#E0B23C"], edge: "#A9801E", glow: "rgba(255,214,80,0.6)", label: "Oro" },
};

export function tierStyle(tier: string) {
  return TIERS[tier] || TIERS.bronze;
}
