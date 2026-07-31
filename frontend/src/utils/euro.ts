/** Format a number as Euro currency (Italian locale). */
export function euro(n: number | undefined | null): string {
  const v = typeof n === "number" ? n : 0;
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
  } catch {
    return `€ ${v.toFixed(2)}`;
  }
}

const MONTHS_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/** "2026-06" -> "Giu 26" */
export function monthLabel(ym: string): string {
  const [y, m] = (ym || "").split("-");
  const mi = parseInt(m, 10) - 1;
  return `${MONTHS_IT[mi] || m} ${(y || "").slice(2)}`;
}

/** "2026-06-15" -> "15 giu 2026" */
export function dateLabel(d: string): string {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}
