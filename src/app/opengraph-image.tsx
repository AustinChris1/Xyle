import { ImageResponse } from "next/og";

export const alt = "Xyle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="200" height="200" fill="none"><path d="M59 32A27 27 0 0 1 5 32A27 27 0 0 1 59 32" stroke="#e0a86a" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="47.12 9.42" stroke-dashoffset="37.7" opacity="0.75"/><path d="M36 11L28 11L30.8 24L33.2 24Z" fill="#e0a86a"/><path d="M48.19 45.96L52.19 39.04L39.53 34.96L38.33 37.04Z" fill="#e0a86a"/><path d="M11.81 39.04L15.81 45.96L25.67 37.04L24.47 34.96Z" fill="#e0a86a"/><circle cx="32" cy="32" r="4.5" fill="#f2652b"/></svg>`;

const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08070d",
          backgroundImage:
            "radial-gradient(ellipse at 12% 0%, rgba(242,101,43,0.32), transparent 55%)",
          padding: "72px 80px",
          color: "#f3f0ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} width={96} height={96} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>
              Xyle
            </div>
            <div
              style={{
                fontSize: 19,
                color: "#9c93a6",
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              Verified answers, with receipts
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: -2.5,
            maxWidth: 940,
          }}
        >
          Answers you can check, not answers you trust.
        </div>

        <div
          style={{
            display: "flex",
            gap: 44,
            fontSize: 21,
            color: "#9c93a6",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>Evidence</span>
          <span style={{ color: "#e0a86a" }}>/</span>
          <span>Authenticity</span>
          <span style={{ color: "#e0a86a" }}>/</span>
          <span>Judgment</span>
        </div>
      </div>
    ),
    size
  );
}
