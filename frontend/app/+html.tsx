// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { iconFontFaceCss } from "@/src/iconFonts";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Speed up icon-font fetches from the CDN. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {/*
          Pre-declare @expo/vector-icons @font-face rules in the SAME <style> element
          expo-font inspects (id="expo-generated-fonts"). This makes Font.isLoaded()
          return true on first render so vector-icons never runs the fontfaceobserver
          polyfill, which otherwise crashes with "6000ms timeout exceeded" on some
          Chromium browsers / slow networks. See src/iconFonts.ts.
        */}
        <style
          id="expo-generated-fonts"
          type="text/css"
          dangerouslySetInnerHTML={{ __html: iconFontFaceCss() }}
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
