import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchCatalog } from "@/lib/telegraph/catalog";

export const dynamic = "force-dynamic";

/**
 * Public miner health feed. Deliberately open: the point of Pulse is that
 * miner operators and other builders can consume it.
 */
export async function GET() {
  const catalog = await fetchCatalog();
  const health = await db.minerHealth(catalog);

  const counts = health.reduce(
    (acc, h) => {
      acc[h.state] = (acc[h.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    at: new Date().toISOString(),
    catalogSize: catalog.length,
    counts,
    miners: health
      .slice()
      .sort((a, b) => {
        const rank = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
        const d = rank[a.state] - rank[b.state];
        return d !== 0 ? d : Number(a.minerId) - Number(b.minerId);
      })
      .map((h) => ({
        ...h,
        badge: `/badge/${h.minerId}.svg`,
      })),
  });
}
