import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "pdu_session_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, options: RequestInit = {}, auth = false) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (auth) Object.assign(headers, await authHeaders());
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      detail = JSON.parse(text).detail;
    } catch {}
    throw new Error(detail || `Errore ${res.status}`);
  }
  return res.json();
}

export const api = {
  liveStatus: () => request("/live/status"),
  podcasts: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return request(`/podcasts?${q.toString()}`);
  },
  categories: () => request("/podcasts/categories"),
  news: () => request("/news"),
  newsItem: (id: string) => request(`/news/${id}`),
  programs: () => request("/programs"),
  collaborators: () => request("/collaborators"),
  prayer: (body: any) => request("/prayer-requests", { method: "POST", body: JSON.stringify(body) }),
  message: (body: any) => request("/messages", { method: "POST", body: JSON.stringify(body) }),
  contact: (body: any) => request("/contact", { method: "POST", body: JSON.stringify(body) }),
  // auth
  register: (body: any) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  session: (session_token: string) =>
    request("/auth/session", { method: "POST", body: JSON.stringify({ session_token }) }),
  me: () => request("/auth/me", {}, true),
  logout: () => request("/auth/logout", { method: "POST" }, true),
  // user data
  favorites: () => request("/me/favorites", {}, true),
  favoriteIds: () => request("/me/favorite-ids", {}, true),
  toggleFavorite: (id: string) => request(`/me/favorites/${id}`, { method: "POST" }, true),
  history: () => request("/me/history", {}, true),
  addHistory: (id: string) => request(`/me/history/${id}`, { method: "POST" }, true),
};
