import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Verified claim";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TONE: Record<string, { word: string; color: string }> = {
  yes: { word: "SUPPORTED", color: "#3ddc97" },
  no: { word: "NOT SUPPORTED", color: "#ff5f6d" },
  uncertain: { word: "NOT ESTABLISHED", color: "#ffc93c" },
};

/**
 * The share card carries the verdict, because a link pasted into an argument
 * has to say something before anyone clicks it.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const claim = await db.getClaim(params.id);
  const tone = TONE[claim?.verdict ?? "uncertain"] ?? TONE.uncertain;
  const text = claim?.claim ?? "Claim not found";

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
            "radial-gradient(ellipse at 10% 0%, rgba(242,101,43,0.28), transparent 55%)",
          padding: "64px 72px",
          color: "#f3f0ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            Xyle
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#9c93a6",
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Verified answers, with receipts
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              lineHeight: 1.25,
              maxWidth: 1000,
              color: "#f3f0ea",
            }}
          >
            {text.length > 190 ? `${text.slice(0, 190)}…` : text}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 700,
                color: tone!.color,
                letterSpacing: -1,
              }}
            >
              {tone!.word}
            </div>
            <div style={{ fontSize: 30, color: "#9c93a6" }}>
              {claim ? `${(claim.confidence * 100).toFixed(0)}% confidence` : ""}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 19,
            color: "#9c93a6",
            letterSpacing: 1,
          }}
        >
          <span>
            {claim ? `${claim.minerCalls} paid miner calls` : "4 miners"}
          </span>
          <span style={{ color: "#e0a86a" }}>/</span>
          <span>{claim ? `${claim.sources.length} dated sources` : "receipts"}</span>
          <span style={{ color: "#e0a86a" }}>/</span>
          <span>on-chain receipts</span>
        </div>
      </div>
    ),
    size
  );
}
