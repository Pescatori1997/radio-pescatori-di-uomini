import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";

export type Track = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  url: string;
  isLive: boolean;
};

type PlayerState = {
  track: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  position: number;
  duration: number;
  playTrack: (t: Track) => void;
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

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    const player = createAudioPlayer();
    player.volume = 1;
    playerRef.current = player;
    const sub = player.addListener("playbackStatusUpdate", (status: any) => {
      setIsPlaying(!!status.playing);
      setIsBuffering(!!status.isBuffering && !status.playing);
      if (typeof status.currentTime === "number") setPosition(status.currentTime);
      if (typeof status.duration === "number" && status.duration > 0) setDuration(status.duration);
    });
    return () => {
      sub?.remove();
      player.release();
    };
  }, []);

  const playTrack = (t: Track) => {
    const player = playerRef.current;
    if (!player) return;
    if (track?.id !== t.id) {
      setTrack(t);
      setPosition(0);
      setDuration(0);
      player.replace({ uri: t.url });
    }
    player.play();
    setIsPlaying(true);
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player || !track) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
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
    playerRef.current?.pause();
    setIsPlaying(false);
    setTrack(null);
  };

  return (
    <PlayerCtx.Provider
      value={{ track, isPlaying, isBuffering, volume, position, duration, playTrack, togglePlay, setVolume, seekTo, stop }}
    >
      {children}
    </PlayerCtx.Provider>
  );
}
