import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { api, liveStreamUrl } from "@/src/api";
import type { LivePlayerConfig } from "@/src/livePlayer";

export type Track = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  url: string;
  isLive: boolean;
};

export type NextProgram = {
  id: string;
  title: string;
  host: string;
  start_time: string;
  end_time: string;
  weekdays?: string[];
  images?: string[];
  starts_at?: string;
};

export type CurrentProgram = {
  id: string;
  title: string;
  host: string;
  start_time: string;
  end_time: string;
};

export type HistoryTrack = {
  title: string;
  artist: string;
  artwork?: string;
  played_at?: number;
};

export type LiveInfo = {
  is_live: boolean;
  is_online: boolean;
  title: string;
  artist: string;
  album?: string;
  artwork: string;
  listeners: number | null;
  refresh_interval: number;
  station_name?: string;
  live_mode?: boolean;
  live_watch_url?: string;
  live_links?: Record<string, string>;
  live_player?: LivePlayerConfig;
  playing_next?: { title: string; artist: string; artwork?: string } | null;
  song_history?: HistoryTrack[];
  current_program?: CurrentProgram | null;
  next_program?: NextProgram | null;
};

export type Connection = "online" | "offline" | "reconnecting";

type PlayerState = {
  track: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  position: number;
  duration: number;
  liveInfo: LiveInfo | null;
  connection: Connection;
  playTrack: (t: Track) => void;
  playLive: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  seekTo: (sec: number) => void;
  stop: () => void;
};

const PlayerCtx = createContext<PlayerState>(null as any);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liveInfo, setLiveInfo] = useState<LiveInfo | null>(null);
  const [connection, setConnection] = useState<Connection>("online");

  // Refs for live reconnection logic (avoid stale closures inside the audio listener).
  const trackRef = useRef<Track | null>(null);
  const shouldPlayLiveRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  trackRef.current = track;

  const clearReconnect = () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
  };

  // --- Radio listening tracking: a listener is counted ONLY while the LIVE
  // audio is actually playing (not merely opening the page). Session +
  // heartbeat with a timeout server-side removes stale/closed listeners. ---
  const radioSessionRef = useRef<string | null>(null);
  const radioBeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLivePlaying = isPlaying && !!track?.isLive;
  useEffect(() => {
    let cancelled = false;
    const stopSession = () => {
      if (radioBeatTimer.current) { clearInterval(radioBeatTimer.current); radioBeatTimer.current = null; }
      const sid = radioSessionRef.current;
      if (sid) { radioSessionRef.current = null; api.radioStop(sid); }
    };
    if (isLivePlaying) {
      api.radioStart().then((r: any) => {
        if (cancelled || !r?.session_id) return;
        radioSessionRef.current = r.session_id;
        radioBeatTimer.current = setInterval(() => {
          if (radioSessionRef.current) api.radioBeat(radioSessionRef.current);
        }, 60000);
      });
    } else {
      stopSession();
    }
    return () => { cancelled = true; if (!isLivePlaying) stopSession(); };
  }, [isLivePlaying]);
  useEffect(() => () => {
    if (radioBeatTimer.current) clearInterval(radioBeatTimer.current);
    if (radioSessionRef.current) api.radioStop(radioSessionRef.current);
  }, []);

  const attemptReconnect = () => {
    const player = playerRef.current;
    const t = trackRef.current;
    if (!player || !t || !t.isLive || !shouldPlayLiveRef.current) return;
    reconnectAttempts.current += 1;
    setConnection(reconnectAttempts.current > 3 ? "offline" : "reconnecting");
    try {
      // Re-open the stream from scratch; low-bandwidth friendly (server pass-through).
      player.replace({ uri: `${liveStreamUrl()}?t=${Date.now()}` });
      player.play();
    } catch (e) {
      console.log("[radio] reconnect error", e);
    }
    // Keep retrying with backoff while the user still wants live audio.
    clearReconnect();
    const delay = reconnectAttempts.current > 3 ? 10000 : 4000;
    reconnectTimer.current = setTimeout(() => {
      if (shouldPlayLiveRef.current && !playerRef.current?.playing) attemptReconnect();
    }, delay);
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    const player = createAudioPlayer();
    player.volume = 1;
    playerRef.current = player;
    const sub = player.addListener("playbackStatusUpdate", (status: any) => {
      const playing = !!status.playing;
      setIsPlaying(playing);
      setIsBuffering(!!status.isBuffering && !playing);
      if (typeof status.currentTime === "number") setPosition(status.currentTime);
      if (typeof status.duration === "number" && status.duration > 0) setDuration(status.duration);

      const t = trackRef.current;
      if (t?.isLive && shouldPlayLiveRef.current) {
        if (playing) {
          // Healthy stream
          reconnectAttempts.current = 0;
          clearReconnect();
          setConnection("online");
        } else if (!status.isBuffering && !reconnectTimer.current) {
          // Stream dropped unexpectedly -> reconnect
          console.log("[radio] stream dropped, reconnecting...");
          setConnection("reconnecting");
          reconnectTimer.current = setTimeout(attemptReconnect, 1500);
        }
      }
    });
    return () => {
      sub?.remove();
      clearReconnect();
      player.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll live metadata every refresh_interval seconds (default 15). Never crashes.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const info = await api.liveStatus();
        if (cancelled) return;
        setLiveInfo(info);
        // Reflect the current song in the live track without restarting audio.
        setTrack((cur) => (cur && cur.id === "live"
          ? { ...cur, title: info.title, artist: info.artist, artwork: info.artwork }
          : cur));
      } catch (e) {
        console.log("[radio] metadata poll failed", e);
      } finally {
        if (!cancelled) {
          const secs = Math.max(5, (liveInfo?.refresh_interval || 15));
          timer = setTimeout(tick, secs * 1000);
        }
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveInfo?.refresh_interval]);

  const playTrack = (t: Track) => {
    const player = playerRef.current;
    if (!player) return;
    shouldPlayLiveRef.current = t.isLive;
    if (!t.isLive) { clearReconnect(); reconnectAttempts.current = 0; }
    if (track?.id !== t.id) {
      setTrack(t);
      setPosition(0);
      setDuration(0);
      player.replace({ uri: t.url });
    }
    player.play();
    setIsPlaying(true);
    if (t.isLive) setConnection("reconnecting");
  };

  const playLive = () => {
    if (track?.id === "live") { togglePlay(); return; }
    playTrack({
      id: "live",
      title: liveInfo?.title || "In Diretta",
      artist: liveInfo?.artist || liveInfo?.station_name || "Pescatori di Uomini",
      artwork: liveInfo?.artwork || "",
      url: liveStreamUrl(),
      isLive: true,
    });
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player || !track) return;
    if (isPlaying) {
      if (track.isLive) { shouldPlayLiveRef.current = false; clearReconnect(); }
      player.pause();
      setIsPlaying(false);
    } else {
      if (track.isLive) {
        shouldPlayLiveRef.current = true;
        reconnectAttempts.current = 0;
        // Re-open a fresh live connection on resume.
        player.replace({ uri: `${liveStreamUrl()}?t=${Date.now()}` });
        setConnection("reconnecting");
      }
      player.play();
      setIsPlaying(true);
    }
  };

  const setVolume = (v: number) => {
    setVolumeState(v);
    if (playerRef.current) playerRef.current.volume = v;
  };

  const seekTo = (sec: number) => {
    if (playerRef.current) playerRef.current.seekTo(sec);
  };

  const stop = () => {
    shouldPlayLiveRef.current = false;
    clearReconnect();
    playerRef.current?.pause();
    setIsPlaying(false);
    setTrack(null);
  };

  // When the admin turns on Live Mode, stop the radio player (the app shows "Watch Live" instead).
  useEffect(() => {
    if (liveInfo?.live_mode && trackRef.current?.isLive) {
      shouldPlayLiveRef.current = false;
      clearReconnect();
      playerRef.current?.pause();
      setIsPlaying(false);
      setTrack(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveInfo?.live_mode]);

  return (
    <PlayerCtx.Provider
      value={{ track, isPlaying, isBuffering, volume, position, duration, liveInfo, connection, playTrack, playLive, togglePlay, setVolume, seekTo, stop }}
    >
      {children}
    </PlayerCtx.Provider>
  );
}
