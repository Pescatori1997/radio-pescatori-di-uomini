export const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const WD_MAP: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

/** Current weekday index (0=Mon) and "HH:MM" in Italian (Europe/Rome) time,
 * regardless of the device timezone — so "on air" is correct also abroad. */
export function romeNow(): { idx: number; hm: string } {
  const d = new Date();
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "long" }).format(d);
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    return { idx: WD_MAP[wd] ?? ((d.getDay() + 6) % 7), hm };
  } catch {
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { idx: (d.getDay() + 6) % 7, hm };
  }
}

/** True if a normalized program is on air right now (Italian time). */
export function isOnAir(p: any): boolean {
  if (!p || p.active === false) return false;
  const start = p.start_time, end = p.end_time;
  if (!start || !end) return false;
  const { idx, hm: cur } = romeNow();
  const today = DAYS[idx];
  const prev = DAYS[(idx + 6) % 7];
  const wd = p.weekdays || [];
  if (end > start) return wd.includes(today) && start <= cur && cur < end;
  return (wd.includes(today) && cur >= start) || (wd.includes(prev) && cur < end);
}

/** The program currently on air from a list, or null. */
export function currentProgram(list: any[]): any | null {
  return (list || []).find((p) => isOnAir(p)) || null;
}
