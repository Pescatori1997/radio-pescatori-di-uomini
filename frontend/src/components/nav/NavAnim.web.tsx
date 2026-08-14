import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import Lottie from "lottie-react";

export type NavAnimProps = {
  url: string;
  kind?: "lottie" | "raster";
  size: number;
  playToken: number;
  onError?: () => void;
};

/**
 * Plays a nav-icon animation ONCE (web). Lottie JSON is fetched and rendered via
 * lottie-react; GIF / animated WebP use expo-image. Any load/parse error falls
 * back to nothing (the parent then shows the static icon), so a broken file can
 * never break the navigation.
 */
export default function NavAnim({ url, kind, size, playToken, onError }: NavAnimProps) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (kind !== "lottie") return;
    let alive = true;
    setData(null);
    setFailed(false);
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (alive) setData(j); })
      .catch(() => { if (alive) { setFailed(true); onError?.(); } });
    return () => { alive = false; };
  }, [url, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return null;

  if (kind === "lottie") {
    if (!data) return null;
    return (
      <Lottie
        key={playToken}
        animationData={data}
        loop={false}
        autoplay
        style={{ width: size + 8, height: size + 8 }}
      />
    );
  }
  return (
    <Image
      key={playToken}
      source={{ uri: url }}
      style={{ width: size, height: size }}
      contentFit="contain"
      onError={() => onError?.()}
    />
  );
}
