import React, { useState } from "react";
import { View, Platform } from "react-native";

/**
 * Wraps a Home section and scales it uniformly (compact/normal/large) while
 * reserving the correct vertical space, so following sections never overlap.
 * Anchored to the top-center so the block stays put horizontally and grows
 * downward. `transformOrigin` is supported on modern RN + react-native-web.
 */
export default function ScaleBox({ scale, children }: { scale: number; children: React.ReactNode }) {
  const [h, setH] = useState(0);
  if (scale === 1) return <>{children}</>;
  return (
    <View style={{ height: h ? Math.round(h * scale) : undefined }}>
      <View
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={{ transform: [{ scale }], transformOrigin: "top center" as any, width: "100%", ...(Platform.OS === "web" ? {} : {}) }}
      >
        {children}
      </View>
    </View>
  );
}
