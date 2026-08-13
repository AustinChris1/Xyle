import { db } from "@/lib/db";
import { fetchCatalog } from "@/lib/telegraph/catalog";

export const dynamic = "force-dynamic";

const COLORS: Record<string, string> = {
  healthy: "#3ddc97",
  degraded: "#ffc93c",
  down: "#ff5f6d",
  unknown: "#8b8598",
};

const LABELS: Record<string, string> = {
  healthy: "healthy",
  degraded: "degraded",
  down: "down",
  unknown: "unproven",
};

/** Rough width for 11px DejaVu-ish text, so the pill fits its label. */
function textWidth(s: string) {
  return Math.ceil(s.length * 6.2) + 12;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!
  );
}

/**
 * An embeddable status badge, so a miner operator can put live uptime in their
 * own README. That is the distribution mechanism: they advertise Xyle because
 * it advertises them.
 *
 * Usage: ![status](https://your-app/badge/202.svg)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const minerId = id.replace(/\.svg$/i, "");

  const catalog = await fetchCatalog();
  const health = await db.minerHealth(catalog);
  const miner = health.find((h) => h.minerId === minerId);

  const state = miner?.state ?? "unknown";
  const color = COLORS[state] ?? COLORS.unknown!;
  const right = miner
    ? state === "healthy" || state === "degraded"
      ? `${LABELS[state]} ${(miner.liveUptime * 100).toFixed(0)}%`
      : LABELS[state]!
    : "not found";

  const left = `miner ${minerId}`;
  const lw = textWidth(left);
  const rw = textWidth(right);
  const w = lw + rw;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(left)}: ${escapeXml(right)}">
  <title>${escapeXml(left)}: ${escapeXml(right)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#2a2733"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(left)}</text>
    <text x="${lw / 2}" y="14">${escapeXml(left)}</text>
    <text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(right)}</text>
    <text x="${lw + rw / 2}" y="14" fill="#0b0a10">${escapeXml(right)}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache: badges should look live, but not hammer the origin.
      "Cache-Control": "public, max-age=120, s-maxage=120",
    },
  });
}
