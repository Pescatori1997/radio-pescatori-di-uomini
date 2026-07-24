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
  crew: () => request("/crew"),
  crewMember: (id: string) => request(`/crew/${id}`),
  applyCrew: (body: any) => request("/crew/applications", { method: "POST", body: JSON.stringify(body) }),
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
  // admin
  adminMe: () => request("/admin/me", {}, true),
  adminStats: () => request("/admin/stats", {}, true),
  adminApplications: (status?: string, sort?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (sort) q.set("sort", sort);
    if (search) q.set("search", search);
    return request(`/admin/applications?${q.toString()}`, {}, true);
  },
  adminApplication: (id: string) => request(`/admin/applications/${id}`, {}, true),
  adminEditApplication: (id: string, body: any) => request(`/admin/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminApprove: (id: string) => request(`/admin/applications/${id}/approve`, { method: "POST" }, true),
  adminReject: (id: string) => request(`/admin/applications/${id}/reject`, { method: "POST" }, true),
  adminDeleteApplication: (id: string) => request(`/admin/applications/${id}`, { method: "DELETE" }, true),
  adminCrew: () => request("/admin/crew", {}, true),
  adminEditCrew: (id: string, body: any) => request(`/admin/crew/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminCrewPortrait: (id: string, portrait: string) => request(`/admin/crew/${id}/portrait`, { method: "POST", body: JSON.stringify({ portrait }) }, true),
  adminDeleteCrew: (id: string) => request(`/admin/crew/${id}`, { method: "DELETE" }, true),
  // admin podcasts
  adminPodcasts: (status?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search) q.set("search", search);
    return request(`/admin/podcasts?${q.toString()}`, {}, true);
  },
  adminCreatePodcast: (body: any) => request("/admin/podcasts", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditPodcast: (id: string, body: any) => request(`/admin/podcasts/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeletePodcast: (id: string) => request(`/admin/podcasts/${id}`, { method: "DELETE" }, true),
  // admin news
  adminNews: (status?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search) q.set("search", search);
    return request(`/admin/news?${q.toString()}`, {}, true);
  },
  adminCreateNews: (body: any) => request("/admin/news", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditNews: (id: string, body: any) => request(`/admin/news/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteNews: (id: string) => request(`/admin/news/${id}`, { method: "DELETE" }, true),
  // admin prayers
  adminPrayers: (status?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search) q.set("search", search);
    return request(`/admin/prayers?${q.toString()}`, {}, true);
  },
  adminPrayer: (id: string) => request(`/admin/prayers/${id}`, {}, true),
  adminEditPrayer: (id: string, body: any) => request(`/admin/prayers/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeletePrayer: (id: string) => request(`/admin/prayers/${id}`, { method: "DELETE" }, true),
  // admin messages & testimonies
  adminMessages: (status?: string, type?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    if (search) q.set("search", search);
    return request(`/admin/messages?${q.toString()}`, {}, true);
  },
  adminMessage: (id: string) => request(`/admin/messages/${id}`, {}, true),
  adminEditMessage: (id: string, body: any) => request(`/admin/messages/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteMessage: (id: string) => request(`/admin/messages/${id}`, { method: "DELETE" }, true),
  // admin users
  adminUsers: (search?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    return request(`/admin/users?${q.toString()}`, {}, true);
  },
  adminDeleteUser: (id: string) => request(`/admin/users/${id}`, { method: "DELETE" }, true),
  adminSetUserRole: (id: string, body: { role: string; permissions?: string[] }) =>
    request(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify(body) }, true),
  // admin programs
  adminPrograms: () => request("/admin/programs", {}, true),
  adminCreateProgram: (body: any) => request("/admin/programs", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditProgram: (id: string, body: any) => request(`/admin/programs/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteProgram: (id: string) => request(`/admin/programs/${id}`, { method: "DELETE" }, true),
  // admin radio & settings
  adminRadio: () => request("/admin/radio", {}, true),
  adminUpdateRadio: (body: any) => request("/admin/radio", { method: "PUT", body: JSON.stringify(body) }, true),
  adminSettings: () => request("/admin/settings", {}, true),
  adminUpdateSettings: (body: any) => request("/admin/settings", { method: "PUT", body: JSON.stringify(body) }, true),
  // merchandising (public)
  products: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return request(`/products?${q.toString()}`);
  },
  product: (id: string) => request(`/products/${id}`),
  productCategories: () => request("/products/categories"),
  // merchandising (admin)
  adminProducts: (status?: string, category?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (category) q.set("category", category);
    if (search) q.set("search", search);
    return request(`/admin/products?${q.toString()}`, {}, true);
  },
  adminProduct: (id: string) => request(`/admin/products/${id}`, {}, true),
  adminCreateProduct: (body: any) => request("/admin/products", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditProduct: (id: string, body: any) => request(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteProduct: (id: string) => request(`/admin/products/${id}`, { method: "DELETE" }, true),
  adminReorderProducts: (ids: string[]) => request("/admin/products/reorder", { method: "POST", body: JSON.stringify({ ids }) }, true),
  // public content
  podcast: (id: string) => request(`/podcasts/${id}`),
  featuredPodcasts: () => request("/podcasts/featured"),
  featuredNews: () => request("/news/featured"),
  newsCategories: () => request("/news/categories"),
  testimonies: () => request("/testimonies"),
  settings: () => request("/settings"),
};
