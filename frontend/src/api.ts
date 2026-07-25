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
  liveStatus: async () => {
    const d = await request("/live/status");
    // Proxy HTTP artwork through the HTTPS backend so it renders on web (no mixed content).
    if (d && typeof d.artwork === "string" && d.artwork.startsWith("http://")) {
      d.artwork = `${BASE}/api/live/art?u=${encodeURIComponent(d.artwork)}`;
    }
    return d;
  },
  podcasts: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return request(`/podcasts?${q.toString()}`);
  },
  categories: () => request("/podcasts/categories"),
  meditations: (search?: string, category?: string) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    return request(`/meditations?${q.toString()}`);
  },
  meditationCategories: () => request("/meditations/categories"),
  meditationItem: (id: string) => request(`/meditations/${id}`),
  adminMeditations: (status?: string, search?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search) q.set("search", search);
    return request(`/admin/meditations?${q.toString()}`, {}, true);
  },
  adminMeditation: (id: string) => request(`/admin/meditations/${id}`, {}, true),
  adminCreateMeditation: (body: any) => request("/admin/meditations", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditMeditation: (id: string, body: any) => request(`/admin/meditations/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteMeditation: (id: string) => request(`/admin/meditations/${id}`, { method: "DELETE" }, true),
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
  adminUsersFiltered: (params: { search?: string; role?: string; status?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.status) q.set("status", params.status);
    if (params.sort) q.set("sort", params.sort);
    return request(`/admin/users?${q.toString()}`, {}, true);
  },
  adminSetUserStatus: (id: string, status: string) =>
    request(`/admin/users/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }, true),
  // invitations
  adminInvitations: () => request("/admin/invitations", {}, true),
  adminCreateInvitation: (body: { email: string; role: string; permissions?: string[] }) =>
    request("/admin/invitations", { method: "POST", body: JSON.stringify(body) }, true),
  adminDeleteInvitation: (id: string) => request(`/admin/invitations/${id}`, { method: "DELETE" }, true),
  getInvitation: (token: string) => request(`/invitations/${token}`),
  acceptInvitation: (token: string, body: { name: string; password: string }) =>
    request(`/invitations/${token}/accept`, { method: "POST", body: JSON.stringify(body) }),
  // activity log
  adminActivity: (limit?: number) => request(`/admin/activity${limit ? `?limit=${limit}` : ""}`, {}, true),
  // admin programs
  adminPrograms: () => request("/admin/programs", {}, true),
  adminCreateProgram: (body: any) => request("/admin/programs", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditProgram: (id: string, body: any) => request(`/admin/programs/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteProgram: (id: string) => request(`/admin/programs/${id}`, { method: "DELETE" }, true),
  // admin radio & settings
  adminRadio: () => request("/admin/radio", {}, true),
  adminUpdateRadio: (body: any) => request("/admin/radio", { method: "PUT", body: JSON.stringify(body) }, true),
  adminRadioStatus: () => request("/admin/radio/status", {}, true),
  adminRadioControl: (action: string) => request("/admin/radio/control", { method: "POST", body: JSON.stringify({ action }) }, true),
  adminRadioLive: (action: string, watch_url?: string) => request("/admin/radio/live", { method: "POST", body: JSON.stringify({ action, watch_url }) }, true),
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
  // donations (Stripe, test mode)
  donationCheckout: (body: { amount: number; origin_url: string; donor_name?: string; donor_email?: string; message?: string; anonymous?: boolean }) =>
    request("/donations/checkout", { method: "POST", body: JSON.stringify(body) }, true),
  donationStatus: (sessionId: string) => request(`/donations/status/${sessionId}`),
  myDonations: () => request("/me/donations", {}, true),
  adminDonations: () => request("/admin/donations", {}, true),
  adminDonationStats: () => request("/admin/donations/stats", {}, true),
  // account extras
  forgotPassword: (email: string) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (body: { email: string; code: string; new_password: string }) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (body: { current_password?: string; new_password: string }) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify(body) }, true),
  updateProfile: (body: { name?: string; picture?: string }) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(body) }, true),
  deleteAccount: () => request("/auth/account", { method: "DELETE" }, true),
  // notification preferences
  getNotifPrefs: () => request("/me/notifications", {}, true),
  setNotifPrefs: (prefs: Record<string, boolean>) =>
    request("/me/notifications", { method: "PUT", body: JSON.stringify(prefs) }, true),
  registerPush: (body: { user_id: string; platform: string; device_token: string }) =>
    request("/register-push", { method: "POST", body: JSON.stringify(body) }),
  // admin notifications
  adminSendNotification: (body: { category: string; title: string; message: string; action_url?: string }) =>
    request("/admin/notifications/send", { method: "POST", body: JSON.stringify(body) }, true),
  adminNotificationsLog: () => request("/admin/notifications", {}, true),
  adminNotificationAudience: () => request("/admin/notifications/audience", {}, true),
  // reports / feedback
  createReport: (body: { category: string; title: string; description: string; screenshot?: string | null; video?: string | null }) =>
    request("/reports", { method: "POST", body: JSON.stringify(body) }, true),
  adminReports: (params?: { status?: string; category?: string; search?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.category) q.set("category", params.category);
    if (params?.search) q.set("search", params.search);
    if (params?.sort) q.set("sort", params.sort);
    return request(`/admin/reports?${q.toString()}`, {}, true);
  },
  adminReport: (id: string) => request(`/admin/reports/${id}`, {}, true),
  adminReportsUnread: () => request("/admin/reports/unread-count", {}, true),
  adminUpdateReport: (id: string, status: string) => request(`/admin/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, true),
  adminDeleteReport: (id: string) => request(`/admin/reports/${id}`, { method: "DELETE" }, true),
};

// HTTPS pass-through URL for the live radio stream (works on web + native).
export const liveStreamUrl = () => `${BASE}/api/live/stream`;
