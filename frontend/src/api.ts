import { storage } from "@/src/utils/storage";
import { Platform } from "react-native";

// Normalise the backend base URL: strip any trailing slash so we never build
// a request like `https://host//api/...` (a double slash breaks the ingress
// `/api` routing and surfaces as CORS/520 errors, especially on uploads).
const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
export const TOKEN_KEY = "pdu_session_token";

/** Public streaming/download URL for an uploaded GridFS media file. */
export const mediaUrl = (id: string, download = false) =>
  `${BASE}/api/media/${id}${download ? "?download=1" : ""}`;

/**
 * Returns a playable audio URL. On web, expo-audio cannot load cross-origin
 * audio without CORS headers, so external files are routed through our
 * same-origin `/api/audio-proxy` (Range-enabled). Same-origin and native URLs
 * are returned unchanged.
 */
export const audioSrc = (url?: string): string => {
  const u = (url || "").trim();
  if (!u) return "";
  if (Platform.OS !== "web") return u;
  if (u.startsWith("/") || u.startsWith(BASE)) return u;
  if (/^https?:\/\//i.test(u)) return `${BASE}/api/audio-proxy?src=${encodeURIComponent(u)}`;
  return u;
};

/**
 * Upload one chunk via XMLHttpRequest. iOS Safari/WebKit frequently aborts
 * `fetch()` uploads with a generic "Load failed" error, whereas XHR is the
 * reliable, well-supported path for request bodies on iOS (and works on
 * Android/native too). Rejects on any non-2xx / network error so the caller
 * can retry the same chunk.
 */
function xhrPutChunk(url: string, body: Blob, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = 120000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(body);
  });
}

/** Chunked upload of a large file (audio/video/image/pdf) to the backend (GridFS). */
export async function uploadMediaChunked(
  file: { uri: string; name: string; mime: string; blob?: Blob },
  onProgress?: (p: number) => void,
  control?: { cancelled?: boolean },
) {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const authH: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const initRes = await fetch(`${BASE}/api/admin/uploads/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authH },
    body: JSON.stringify({ filename: file.name, mime: file.mime }),
  });
  if (!initRes.ok) {
    const e = await initRes.json().catch(() => ({}));
    throw new Error(e.detail || "Impossibile avviare il caricamento");
  }
  const { upload_id } = await initRes.json();

  const blob = file.blob || (await (await fetch(file.uri)).blob());
  const total = blob.size;
  // Larger chunks = far fewer round-trips (a 200MB file becomes ~40 requests
  // instead of ~100), which is dramatically more reliable on high-latency
  // connections and reduces the chance of transient 503s. Still safely under
  // typical edge/proxy per-request body limits.
  const CHUNK = 5 * 1024 * 1024;
  const putChunk = async (start: number, part: Blob, attempt = 0): Promise<void> => {
    const url = `${BASE}/api/admin/uploads/${upload_id}/chunk`;
    const headers = { ...authH, "X-Chunk-Offset": String(start) };
    try {
      if (Platform.OS === "web") {
        // XHR is far more reliable than fetch for uploads on iOS Safari.
        await xhrPutChunk(url, part, headers);
      } else {
        const r = await fetch(url, { method: "PUT", headers, body: part });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
    } catch {
      if (control?.cancelled) throw new Error("Caricamento annullato");
      // Transient failures (503/502/504 from the edge, network drops, timeouts)
      // are common on slow/unstable connections. Retry the same chunk with
      // exponential backoff — the write is idempotent server-side (keyed by
      // byte offset) so retries never corrupt the file.
      if (attempt < 5) {
        const backoff = Math.min(1000 * 2 ** attempt, 15000);
        await new Promise((res) => setTimeout(res, backoff));
        return putChunk(start, part, attempt + 1);
      }
      throw new Error("Caricamento interrotto. Connessione instabile: riprova, riprenderà da capo.");
    }
  };
  for (let start = 0; start < total; start += CHUNK) {
    if (control?.cancelled) throw new Error("Caricamento annullato");
    const part = blob.slice(start, Math.min(start + CHUNK, total));
    await putChunk(start, part);
    onProgress?.(Math.min(start + CHUNK, total) / total);
  }
  const c = await fetch(`${BASE}/api/admin/uploads/${upload_id}/complete`, {
    method: "POST",
    headers: { ...authH },
  });
  if (!c.ok) {
    const e = await c.json().catch(() => ({}));
    throw new Error(e.detail || "Finalizzazione non riuscita");
  }
  const done = await c.json();
  // Backward compat: an older backend finalises synchronously and already
  // returns the media fields here.
  if (done && done.media_id) return done;
  // New backend finalises in the background (so /complete can't time out on big
  // files). Poll the status until the media is ready.
  const statusUrl = `${BASE}/api/admin/uploads/${upload_id}/complete/status`;
  const deadline = Date.now() + 10 * 60 * 1000; // up to 10 min for very large files
  while (Date.now() < deadline) {
    if (control?.cancelled) throw new Error("Caricamento annullato");
    await new Promise((res) => setTimeout(res, 2000));
    let s: any;
    try {
      const r = await fetch(statusUrl, { headers: { ...authH } });
      if (r.status === 500) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || "Errore durante l'elaborazione del file");
      }
      if (!r.ok) continue; // transient (e.g. 502/503/520) → keep polling
      s = await r.json();
    } catch (err: any) {
      if (err?.message && !/fetch|network|Load failed/i.test(err.message)) throw err;
      continue; // network blip → keep polling
    }
    if (s.status === "done" && s.media_id) return s;
  }
  throw new Error("Elaborazione del file troppo lunga. Riprova.");
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The backend returns lightweight, relative image URLs ("/api/img/...") inside
// list/detail responses (base64 is no longer inlined → much smaller & faster).
// Prepend the known backend base so <Image> works on web (same-origin) and
// native alike. Recurses through objects/arrays; only rewrites matching strings.
function absolutizeImages(node: any): any {
  if (typeof node === "string") {
    return node.startsWith("/api/img/") ? `${BASE}${node}` : node;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = absolutizeImages(node[i]);
    return node;
  }
  if (node && typeof node === "object") {
    for (const k in node) node[k] = absolutizeImages(node[k]);
    return node;
  }
  return node;
}

async function request(path: string, options: RequestInit = {}, auth = false) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (auth) Object.assign(headers, await authHeaders());
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  } catch {
    // Network unreachable / DNS / offline
    throw new Error("Nessuna connessione al server. Controlla la rete e riprova.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail: string | undefined;
    try {
      detail = JSON.parse(text).detail;
    } catch {}
    // Gateway / infra errors return an HTML page (no JSON detail): the backend was
    // momentarily unreachable/restarting — surface that instead of a misleading message.
    if (!detail) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error("Server momentaneamente non raggiungibile. Riprova tra qualche secondo.");
      }
      throw new Error(`Errore ${res.status}`);
    }
    throw new Error(detail);
  }
  return absolutizeImages(await res.json());
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
  meditationInteractions: (id: string) => request(`/meditations/${id}/interactions`, {}, true).catch(() => request(`/meditations/${id}/interactions`)),
  meditationLike: (id: string) => request(`/meditations/${id}/like`, { method: "POST" }, true),
  meditationPray: (id: string) => request(`/meditations/${id}/pray`, { method: "POST" }, true),
  meditationComments: (id: string) => request(`/meditations/${id}/comments`),
  meditationComment: (id: string, text: string) => request(`/meditations/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }, true),
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
  programBySlug: (slug: string) => request(`/program/${encodeURIComponent(slug)}`),
  favoriteProgramIds: () => request("/me/favorite-programs", {}, true),
  toggleFavoriteProgram: (id: string) => request(`/me/favorite-programs/${id}`, { method: "POST" }, true),
  currentProgram: () => request("/programs/current"),
  programsByDay: (weekday: string) => request(`/programs/day/${encodeURIComponent(weekday)}`),
  collaborators: () => request("/collaborators"),
  crew: () => request("/crew"),
  crewRanks: () => request("/crew/ranks"),
  crewMember: (id: string) => request(`/crew/${id}`),
  applyCrew: (body: any) => request("/crew/applications", { method: "POST", body: JSON.stringify(body) }),
  prayer: (body: any) => request("/prayer-requests", { method: "POST", body: JSON.stringify(body) }, true),
  prayerBoard: (clientId?: string) => request(`/prayer-board${clientId ? `?client_id=${encodeURIComponent(clientId)}` : ""}`, {}, true),
  prayFor: (id: string, clientId?: string) => request(`/prayer-board/${id}/pray`, { method: "POST", body: JSON.stringify({ client_id: clientId }) }, true),
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
  // generic favorites for meditazioni + CMS content
  contentFavIds: () => request("/me/content-fav-ids", {}, true),
  toggleContentFav: (type: string, id: string) => request(`/me/content-fav/${type}/${encodeURIComponent(id)}`, { method: "POST" }, true),
  myLibrary: () => request("/me/library", {}, true),
  // Biblioteca folders (admin-managed) + per-content assignment
  libraryFolders: () => request("/library-folders"),
  adminLibraryFolders: () => request("/admin/library-folders", {}, true),
  adminCreateFolder: (b: any) => request("/admin/library-folders", { method: "POST", body: JSON.stringify(b) }, true),
  adminUpdateFolder: (id: string, b: any) => request(`/admin/library-folders/${id}`, { method: "PUT", body: JSON.stringify(b) }, true),
  adminDeleteFolder: (id: string) => request(`/admin/library-folders/${id}`, { method: "DELETE" }, true),
  adminContentCatalog: () => request("/admin/content-catalog", {}, true),
  adminSetContentFolder: (b: any) => request("/admin/content-folder", { method: "POST", body: JSON.stringify(b) }, true),
  history: () => request("/me/history", {}, true),
  addHistory: (id: string) => request(`/me/history/${id}`, { method: "POST" }, true),
  // admin
  adminMe: () => request("/admin/me", {}, true),

  // notification center (inbox)
  inboxList: (limit = 30, skip = 0) => request(`/inbox?limit=${limit}&skip=${skip}`, {}, true),
  inboxUnread: () => request("/inbox/unread-count", {}, true),
  inboxRead: (id: string) => request(`/inbox/${id}/read`, { method: "POST" }, true),
  inboxReadAll: () => request("/inbox/read-all", { method: "POST" }, true),

  // agenda (centro operativo)
  agendaCategories: () => request("/agenda/categories", {}, true),
  agendaCollaborators: () => request("/agenda/collaborators", {}, true),
  agendaDashboard: () => request("/agenda/dashboard", {}, true),
  agendaEvents: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/agenda/events${qs ? `?${qs}` : ""}`, {}, true);
  },
  agendaEvent: (id: string) => request(`/agenda/events/${id}`, {}, true),
  agendaCreate: (body: any) => request("/agenda/events", { method: "POST", body: JSON.stringify(body) }, true),
  agendaUpdate: (id: string, body: any) => request(`/agenda/events/${id}`, { method: "PUT", body: JSON.stringify(body) }, true),
  agendaDelete: (id: string) => request(`/agenda/events/${id}`, { method: "DELETE" }, true),
  agendaRsvp: (id: string, status: string) => request(`/agenda/events/${id}/rsvp`, { method: "POST", body: JSON.stringify({ status }) }, true),
  agendaTaskCreate: (eid: string, body: any) => request(`/agenda/events/${eid}/tasks`, { method: "POST", body: JSON.stringify(body) }, true),
  agendaTaskUpdate: (tid: string, body: any) => request(`/agenda/tasks/${tid}`, { method: "PUT", body: JSON.stringify(body) }, true),
  agendaTaskDelete: (tid: string) => request(`/agenda/tasks/${tid}`, { method: "DELETE" }, true),
  agendaCommentCreate: (eid: string, body: any) => request(`/agenda/events/${eid}/comments`, { method: "POST", body: JSON.stringify(body) }, true),
  agendaCommentDelete: (cid: string) => request(`/agenda/comments/${cid}`, { method: "DELETE" }, true),
  agendaTypingPing: (eid: string) => request(`/agenda/events/${eid}/typing`, { method: "POST" }, true),
  agendaTyping: (eid: string) => request(`/agenda/events/${eid}/typing`, {}, true),
  // Traguardi del Cammino (achievements / walk board)
  myAchievements: () => request("/me/achievements", {}, true),
  adminAchievements: () => request("/admin/achievements", {}, true),
  adminAchievementItem: (id: string) => request(`/admin/achievements/${id}`, {}, true),
  adminCreateAchievement: (b: any) => request("/admin/achievements", { method: "POST", body: JSON.stringify(b) }, true),
  adminEditAchievement: (id: string, b: any) => request(`/admin/achievements/${id}`, { method: "PATCH", body: JSON.stringify(b) }, true),
  adminDeleteAchievement: (id: string) => request(`/admin/achievements/${id}`, { method: "DELETE" }, true),
  adminAchievementsOrder: (ids: string[]) => request("/admin/achievements/order", { method: "POST", body: JSON.stringify({ ids }) }, true),
  adminAssignAchievement: (id: string, email: string) => request(`/admin/achievements/${id}/assign`, { method: "POST", body: JSON.stringify({ email }) }, true),
  adminUnassignAchievement: (id: string, email: string) => request(`/admin/achievements/${id}/unassign`, { method: "POST", body: JSON.stringify({ email }) }, true),
  adminWalkBoard: () => request("/admin/walk-board", {}, true),
  adminEditWalkBoard: (b: any) => request("/admin/walk-board", { method: "PATCH", body: JSON.stringify(b) }, true),
  agendaAttachCreate: (eid: string, body: any) => request(`/agenda/events/${eid}/attachments`, { method: "POST", body: JSON.stringify(body) }, true),
  agendaAttachDelete: (aid: string) => request(`/agenda/attachments/${aid}`, { method: "DELETE" }, true),
  agendaAudit: (eid: string) => request(`/agenda/events/${eid}/audit`, {}, true),
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
  adminCrewRanks: () => request("/admin/crew/ranks", {}, true),
  adminCreateRank: (body: any) => request("/admin/crew/ranks", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditRank: (id: string, body: any) => request(`/admin/crew/ranks/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteRank: (id: string) => request(`/admin/crew/ranks/${id}`, { method: "DELETE" }, true),
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
  // Showcase (Vetrina)
  showcase: () => request("/showcase"),
  adminShowcase: () => request("/admin/showcase", {}, true),
  adminShowcaseItem: (id: string) => request(`/admin/showcase/${id}`, {}, true),
  adminCreateShowcase: (body: any) => request("/admin/showcase", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditShowcase: (id: string, body: any) => request(`/admin/showcase/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteShowcase: (id: string) => request(`/admin/showcase/${id}`, { method: "DELETE" }, true),
  adminShowcaseOrder: (ids: string[]) => request("/admin/showcase/order", { method: "POST", body: JSON.stringify({ ids }) }, true),
  // admin prayers
  adminPrayers: (filter?: string, search?: string) => {
    const q = new URLSearchParams();
    if (filter) q.set("filter", filter);
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
  donationSubscribe: (body: { plan: string; origin_url: string; donor_email?: string }) =>
    request("/donations/subscribe", { method: "POST", body: JSON.stringify(body) }, true),
  orderCheckout: (body: { items: any[]; delivery: any; origin_url: string; note?: string }) =>
    request("/orders/checkout", { method: "POST", body: JSON.stringify(body) }, true),
  orderStatus: (sessionId: string) => request(`/orders/status/${sessionId}`),
  adminOrders: (status?: string) => request(`/admin/orders${status ? `?status=${status}` : ""}`, {}, true),
  adminUpdateOrder: (id: string, body: any) => request(`/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
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
  webpushPublicKey: () => request("/webpush/public-key"),
  webpushSubscribe: (body: { user_id?: string | null; subscription: any }) =>
    request("/webpush/subscribe", { method: "POST", body: JSON.stringify(body) }),
  webpushUnsubscribe: (body: { subscription: any }) =>
    request("/webpush/unsubscribe", { method: "POST", body: JSON.stringify(body) }),
  // admin notifications
  adminSendNotification: (body: { category: string; title: string; message: string; action_url?: string }) =>
    request("/admin/notifications/send", { method: "POST", body: JSON.stringify(body) }, true),
  adminNotificationsLog: () => request("/admin/notifications", {}, true),
  adminNotificationAudience: () => request("/admin/notifications/audience", {}, true),
  adminWebpushStats: () => request("/admin/webpush/stats", {}, true),
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

  // verse of the day
  verseToday: () => request("/verse/today"),
  verse: (id: string) => request(`/verse/${id}`),
  verseMeditation: (id: string) => request(`/verse/${id}/meditation`),
  adminVerses: (search?: string) => request(`/admin/verses${search ? `?search=${encodeURIComponent(search)}` : ""}`, {}, true),
  adminCreateVerse: (body: any) => request("/admin/verses", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditVerse: (id: string, body: any) => request(`/admin/verses/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDeleteVerse: (id: string) => request(`/admin/verses/${id}`, { method: "DELETE" }, true),
  adminRegenerateMeditation: (id: string) => request(`/admin/verses/${id}/regenerate-meditation`, { method: "POST" }, true),
  adminVerseNotif: () => request("/admin/verse-notification", {}, true),
  adminUpdateVerseNotif: (body: { enabled?: boolean; title?: string; message?: string }) =>
    request("/admin/verse-notification", { method: "PUT", body: JSON.stringify(body) }, true),
  adminNotifyVerseToday: () => request("/admin/verses/notify-today", { method: "POST" }, true),

  // timoteo — guida intelligente
  timoteoChat: (messages: { role: string; content: string }[]) =>
    request("/timoteo/chat", { method: "POST", body: JSON.stringify({ messages }) }, true),

  // supporter status (authoritative, synced from Stripe server-side)
  mySubscription: () => request("/me/subscription", {}, true),
  cancelSubscription: () => request("/me/subscription/cancel", { method: "POST" }, true),

  // ---- analytics & community social proof ----
  trackActive: () => request("/track/active", { method: "POST" }, true).catch(() => null),
  trackContent: (kind: string, id: string, action: "view" | "play" = "view") =>
    request("/track/content", { method: "POST", body: JSON.stringify({ kind, id, action }) }, true).catch(() => null),
  radioStart: () => request("/track/radio/start", { method: "POST" }, true).catch(() => ({ session_id: null })),
  radioBeat: (session_id: string) => request("/track/radio/beat", { method: "POST", body: JSON.stringify({ session_id }) }, true).catch(() => null),
  radioStop: (session_id: string) => request("/track/radio/stop", { method: "POST", body: JSON.stringify({ session_id }) }, true).catch(() => null),
  communityStats: () => request("/community/stats"),
  radioListeners: () => request("/community/radio-listeners"),
  contentStats: (kind: string, id: string) =>
    request(`/content/stats?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`),
  adminAnalytics: (range: string) => request(`/admin/analytics?range=${range}`, {}, true),

  /**
   * Streaming chat via SSE over XMLHttpRequest (works on both web and native —
   * React Native's fetch has no ReadableStream reader, XHR.onprogress does).
   * Calls onDelta(text) as reply chunks arrive and onDone({reply,actions}) at the
   * end. Returns an abort() function.
   */
  timoteoStream: (
    messages: { role: string; content: string }[],
    handlers: {
      onDelta: (text: string) => void;
      onDone: (data: { reply: string; actions: any[] }) => void;
      onError: () => void;
    },
  ) => {
    let aborted = false;
    const xhr = new XMLHttpRequest();
    let offset = 0; // bytes of responseText already parsed
    let done = false;

    const process = () => {
      const buf = xhr.responseText || "";
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buf.indexOf("\n\n", offset)) !== -1) {
        const frame = buf.slice(offset, sep);
        offset = sep + 2;
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const ev = JSON.parse(jsonStr);
          if (ev.type === "delta" && typeof ev.text === "string") handlers.onDelta(ev.text);
          else if (ev.type === "done") { done = true; handlers.onDone({ reply: ev.reply || "", actions: ev.actions || [] }); }
        } catch { /* ignore partial/invalid frame */ }
      }
    };

    (async () => {
      const authH = await authHeaders();
      if (aborted) return;
      xhr.open("POST", `${BASE}/api/timoteo/stream`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "text/event-stream");
      Object.entries(authH).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.onprogress = process;
      xhr.onload = () => { process(); if (!done) handlers.onError(); };
      xhr.onerror = () => { if (!aborted) handlers.onError(); };
      xhr.ontimeout = () => { if (!aborted) handlers.onError(); };
      xhr.timeout = 120000;
      xhr.send(JSON.stringify({ messages }));
    })();

    return () => { aborted = true; try { xhr.abort(); } catch { /* noop */ } };
  },

  // bible reader
  bibleTranslations: () => request("/bible/translations"),
  bibleBooks: (translation?: string) => request(`/bible/books${translation ? `?translation=${translation}` : ""}`),
  bibleChapter: (book: number, chapter: number, translation?: string) =>
    request(`/bible/chapter?book=${book}&chapter=${chapter}${translation ? `&translation=${translation}` : ""}`),
  bibleResolve: (reference: string, translation?: string) =>
    request(`/bible/resolve?reference=${encodeURIComponent(reference)}${translation ? `&translation=${translation}` : ""}`),
  bibleSearch: (q: string, book?: number, translation?: string) =>
    request(`/bible/search?q=${encodeURIComponent(q)}${book ? `&book=${book}` : ""}${translation ? `&translation=${translation}` : ""}`),
  getBibleState: () => request("/me/bible/state", {}, true),
  setBibleState: (body: { translation?: string; book_nr: number; chapter: number; verse?: number }) =>
    request("/me/bible/state", { method: "PUT", body: JSON.stringify(body) }, true),
  bibleAnnotations: (book_nr: number, chapter: number, translation?: string) =>
    request(`/me/bible/annotations?book_nr=${book_nr}&chapter=${chapter}${translation ? `&translation=${translation}` : ""}`, {}, true),
  bibleBookmarks: () => request("/me/bible/bookmarks", {}, true),
  bibleSaveBookmark: (body: any) => request("/me/bible/bookmarks", { method: "POST", body: JSON.stringify(body) }, true),
  bibleDeleteBookmark: (id: string) => request(`/me/bible/bookmarks/${id}`, { method: "DELETE" }, true),
  bibleNotes: () => request("/me/bible/notes", {}, true),
  bibleCreateNote: (body: any) => request("/me/bible/notes", { method: "POST", body: JSON.stringify(body) }, true),
  bibleEditNote: (id: string, note: string) => request(`/me/bible/notes/${id}`, { method: "PATCH", body: JSON.stringify({ note }) }, true),
  bibleDeleteNote: (id: string) => request(`/me/bible/notes/${id}`, { method: "DELETE" }, true),

  // generic CMS content (reused by every section)
  contentSections: () => request("/content-sections"),
  contents: (section: string, params?: { search?: string; category?: string; tag?: string }) => {
    const clean: any = { section };
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") clean[k] = v; });
    const q = new URLSearchParams(clean).toString();
    return request(`/contents?${q}`);
  },
  contentItem: (id: string) => request(`/contents/${id}`),
  adminContents: (section: string, params?: { status?: string; search?: string }) => {
    const clean: any = { section };
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") clean[k] = v; });
    const q = new URLSearchParams(clean).toString();
    return request(`/admin/contents?${q}`, {}, true);
  },
  adminContent: (id: string) => request(`/admin/contents/item/${id}`, {}, true),
  adminCreateContent: (body: any) => request("/admin/contents", { method: "POST", body: JSON.stringify(body) }, true),
  adminEditContent: (id: string, body: any) => request(`/admin/contents/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true),
  adminDuplicateContent: (id: string) => request(`/admin/contents/${id}/duplicate`, { method: "POST" }, true),
  adminDeleteContent: (id: string) => request(`/admin/contents/${id}`, { method: "DELETE" }, true),

  // Bible reading plans (Piani di Lettura)
  readingPlans: () => request("/reading-plans"),
  readingPlan: (id: string) => request(`/reading-plans/${id}`, {}, true),
  myReadingPlans: () => request("/me/reading-plans", {}, true),
  enrollPlan: (id: string) => request(`/me/reading-plans/${id}/enroll`, { method: "POST" }, true),
  togglePlanDay: (id: string, day: number, done: boolean) =>
    request(`/me/reading-plans/${id}/day/${day}`, { method: "POST", body: JSON.stringify({ done }) }, true),
  unenrollPlan: (id: string) => request(`/me/reading-plans/${id}`, { method: "DELETE" }, true),
  // admin reading plans
  adminReadingPlans: () => request("/admin/reading-plans", {}, true),
  adminReadingPlan: (id: string) => request(`/admin/reading-plans/${id}`, {}, true),
  adminCreatePlan: (body: any) => request("/admin/reading-plans", { method: "POST", body: JSON.stringify(body) }, true),
  adminUpdatePlan: (id: string, body: any) => request(`/admin/reading-plans/${id}`, { method: "PUT", body: JSON.stringify(body) }, true),
  adminDeletePlan: (id: string) => request(`/admin/reading-plans/${id}`, { method: "DELETE" }, true),

  // Finance — Trasparenza Economica
  financeCategories: () => request("/admin/finance/categories", {}, true),
  financeSummary: () => request("/admin/finance/summary", {}, true),
  financeEntries: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    return request(`/admin/finance/entries?${q.toString()}`, {}, true);
  },
  financeEntryAttachment: (id: string) => request(`/admin/finance/entries/${id}/attachment`, {}, true),
  financeCreateEntry: (body: any) => request("/admin/finance/entries", { method: "POST", body: JSON.stringify(body) }, true),
  financeUpdateEntry: (id: string, body: any) => request(`/admin/finance/entries/${id}`, { method: "PUT", body: JSON.stringify(body) }, true),
  financeDeleteEntry: (id: string) => request(`/admin/finance/entries/${id}`, { method: "DELETE" }, true),
  financeLedger: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    return request(`/admin/finance/ledger?${q.toString()}`, {}, true);
  },
  financeDecisions: () => request("/admin/finance/decisions", {}, true),
  financeCreateDecision: (body: any) => request("/admin/finance/decisions", { method: "POST", body: JSON.stringify(body) }, true),
  financeUpdateDecision: (id: string, body: any) => request(`/admin/finance/decisions/${id}`, { method: "PUT", body: JSON.stringify(body) }, true),
  financeDeleteDecision: (id: string) => request(`/admin/finance/decisions/${id}`, { method: "DELETE" }, true),
  financeAudit: () => request("/admin/finance/audit", {}, true),
};

// HTTPS pass-through URL for the live radio stream (works on web + native).
export const liveStreamUrl = () => `${BASE}/api/live/stream`;
export const verseMeditationAudioUrl = (id: string) => `${BASE}/api/verse/${id}/meditation/audio`;
