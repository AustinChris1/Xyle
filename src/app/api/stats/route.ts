import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { nodeHealth } from "@/lib/telegraph/clients";

export const dynamic = "force-dynamic";

/** Public status feed for the header ribbon. Deliberately free of node internals. */
export async function GET() {
  const markets = await db.listMarkets();
  const cfg = loadConfig();
  const health = await nodeHealth();

  return NextResponse.json({
    marketsOpen: markets.filter((m) => m.status === "open").length,
    marketsSettled: markets.filter((m) => m.status.startsWith("settled")).length,
    totalStakes: (await db.listStakes()).length,
    totalChallenges: (await db.listChallenges()).length,
    minerRequests: await db.minerRequests(),
    totalCostUsdc: await db.totalCostUsdc(),
    mockMode: cfg.mockMode,
    hasEvmKey: cfg.hasEvmKey,
    paymentNetwork: cfg.evmNetwork,
    nodeOk: health.ok,
    integrations: health.integrations,
    intervalMinutes: cfg.oracleIntervalMinutes,
    lastCronAt: await db.lastCronAt(),
    miners: {
      news: cfg.newsMinerId,
      authenticity: cfg.authMinerId,
      reason: cfg.reasonMinerId,
      consensus: cfg.consensusMinerId,
    },
  });
}
