import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { registerForPush } from "@/src/utils/push";

WebBrowser.maybeCompleteAuthSession();

const GUEST_KEY = "pdu_guest_mode";

export const ROLE_ADMIN = "administrator";
export const ROLE_COLLAB = "collaborator";
export const ROLE_LISTENER = "listener";
export type PermSection = "podcasts" | "news" | "merch" | "schedule" | "prayers" | "messages" | "radio" | "users";

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[#?&]session_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role?: string;
  permissions?: string[];
};

type AuthState = {
  user: User | null;
  loading: boolean;
  guestChosen: boolean;
  isAdmin: boolean;
  isCollaborator: boolean;
  can: (section: PermSection) => boolean;
  continueAsGuest: () => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, name: string, password: string) => Promise<User>;
  updateProfile: (body: { name?: string; picture?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestChosen, setGuestChosen] = useState(false);

  const setToken = async (token: string) => storage.secureSet(TOKEN_KEY, token);

  const loadMe = async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
      await storage.secureRemove(TOKEN_KEY);
    }
  };

  const processSessionId = async (sessionId: string) => {
    const res = await api.session(sessionId);
    await setToken(res.token);
    setUser(res.user);
    setGuestChosen(false);
    await storage.removeItem(GUEST_KEY);
  };

  useEffect(() => {
    let urlSub: { remove: () => void } | undefined;
    (async () => {
      // Web: check for session_id in URL fragment/query first
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
        if (sid) {
          try {
            await processSessionId(sid);
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
          setLoading(false);
          return;
        }
      } else {
        // Native cold-start: app opened via deep link carrying session_id
        const initialUrl = await Linking.getInitialURL();
        const sid = extractSessionId(initialUrl);
        if (sid) {
          try { await processSessionId(sid); } catch {}
        }
        // Hot deep-link listener (fallback to openAuthSessionAsync result)
        urlSub = Linking.addEventListener("url", async ({ url }) => {
          const s = extractSessionId(url);
          if (s) {
            try { await processSessionId(s); } catch {}
          }
        });
      }
      const guest = await storage.getItem<boolean>(GUEST_KEY, false);
      if (guest) setGuestChosen(true);
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) await loadMe();
      setLoading(false);
    })();
    return () => { urlSub?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueAsGuest = async () => {
    await storage.setItem(GUEST_KEY, true);
    setGuestChosen(true);
  };

  const loginGoogle = async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const redirectUrl = window.location.origin + "/";
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      // Break out of the preview iframe if embedded (OAuth cannot run inside a cross-origin iframe).
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = authUrl;
          return;
        }
      } catch {
        // Cross-origin iframe: cannot access window.top -> open OAuth in a new top-level tab.
        window.open(authUrl, "_blank");
        return;
      }
      window.location.href = authUrl;
      return;
    }
    const redirectUrl = Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success") {
      const sid = extractSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  };

  const loginEmail = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    await setToken(res.token);
    setUser(res.user);
    setGuestChosen(false);
    await storage.removeItem(GUEST_KEY);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password });
    await setToken(res.token);
    setUser(res.user);
    setGuestChosen(false);
    await storage.removeItem(GUEST_KEY);
  };

  const acceptInvite = async (token: string, name: string, password: string) => {
    const res = await api.acceptInvitation(token, { name, password });
    await setToken(res.token);
    setUser(res.user);
    setGuestChosen(false);
    await storage.removeItem(GUEST_KEY);
    return res.user as User;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  const updateProfile = async (body: { name?: string; picture?: string }) => {
    const updated = await api.updateProfile(body);
    setUser(updated);
  };

  const refreshUser = async () => {
    await loadMe();
  };

  // Register the device for push whenever a user becomes authenticated (native only, non-blocking).
  useEffect(() => {
    if (user?.user_id) registerForPush(user.user_id);
  }, [user?.user_id]);

  const role = user?.role;
  const isAdmin = role === ROLE_ADMIN;
  const isCollaborator = role === ROLE_COLLAB;
  const can = (section: PermSection) =>
    isAdmin || (isCollaborator && (user?.permissions || []).includes(section));

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        guestChosen,
        isAdmin,
        isCollaborator,
        can,
        continueAsGuest,
        loginGoogle,
        loginEmail,
        register,
        acceptInvite,
        updateProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
