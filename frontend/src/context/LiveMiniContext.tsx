import React, { createContext, useContext, useState } from "react";

type Ctx = { visible: boolean; open: () => void; close: () => void };

const LiveMiniContext = createContext<Ctx>({ visible: false, open: () => {}, close: () => {} });

export const useLiveMini = () => useContext(LiveMiniContext);

export function LiveMiniProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <LiveMiniContext.Provider value={{ visible, open: () => setVisible(true), close: () => setVisible(false) }}>
      {children}
    </LiveMiniContext.Provider>
  );
}
