import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, TOKEN_KEY } from "@/src/api";
import { storage } from "@/src/utils/storage";

type User = { user_id: string; email: string; name: string; picture?: string | null };

type AuthState = {
  user: User | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
  };

  useEffect(() => {
    (async () => {
      // Web: check for session_id in URL fragment/query first
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        const match = hash.match(/session_id=([^&]+)/) || search.match(/session_id=([^&]+)/);
        if (match) {
          try {
            await processSessionId(decodeURIComponent(match[1]));
            window.history.replaceState(null, "", window.location.pathname);
          } catch {}
          setLoading(false);
          return;
        }
      }
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (token) await loadMe();
      setLoading(false);
    })();
  }, []);

  const loginGoogle = async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const match =
        result.url.match(/session_id=([^&]+)/) || result.url.match(/#session_id=([^&]+)/);
      if (match) await processSessionId(decodeURIComponent(match[1]));
    }
  };

  const loginEmail = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password });
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, loginGoogle, loginEmail, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
