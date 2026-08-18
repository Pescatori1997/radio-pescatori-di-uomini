import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

/**
 * Lightweight favorites state for a single content type (meditazioni / CMS).
 * Fetches the user's favorited ids once and exposes optimistic toggle.
 */
export function useContentFav(type: string) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!user) { setIds(new Set()); return; }
    api.contentFavIds().then((m: any) => setIds(new Set((m?.[type] as string[]) || []))).catch(() => {});
  }, [user, type]);

  useEffect(() => { load(); }, [load]);

  const isFav = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback(async (id: string) => {
    if (!user) return false;
    const next = new Set(ids);
    const willFav = !next.has(id);
    if (willFav) next.add(id); else next.delete(id);
    setIds(next); // optimistic
    try {
      const r = await api.toggleContentFav(type, id);
      return !!r?.favorited;
    } catch {
      load(); // revert on error
      return !willFav;
    }
  }, [ids, user, type, load]);

  return { isFav, toggle, isLogged: !!user, reload: load };
}
