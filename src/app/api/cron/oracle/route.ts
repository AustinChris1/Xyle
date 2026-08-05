import { NextResponse, after } from "next/server";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { runCronCycle } from "@/lib/oracle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Always-on cycle: auto-open markets from news + tick the oldest-read markets.
 *
 * A cycle takes ~40s because every reading is four paid miner calls, which is
 * longer than most external schedulers will wait (cron-job.org's free tier
 * cuts off at 30s). So the response goes out immediately and the work runs in
 * `after()`, which Next keeps alive up to `maxDuration`. The scheduler sees a
 * fast 202 instead of a timeout, and the cycle still completes.
 *
 * Pass `?sync=1` to run inline and get the full result, for manual testing.
 */
export async function GET(req: Request) {
  const cfg = loadConfig();
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const urlSecret = url.searchParams.get("secret");

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
  const vercelCron = req.headers.get("x-vercel-cron");

  if (!cfg.cronSecret && !vercelCron) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (
    cfg.cronSecret &&
    token !== cfg.cronSecret &&
    urlSecret !== cfg.cronSecret &&
    !vercelCron
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Inline mode for curl and debugging. Can exceed a scheduler's timeout.
  if (url.searchParams.get("sync") === "1") {
    try {
      const result = await runCronCycle();
      return NextResponse.json({
        ok: true,
        mode: "sync",
        at: new Date().toISOString(),
        intervalMinutes: cfg.oracleIntervalMinutes,
        ...result,
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  // Reported up front so a caller sees the budget without waiting for the run.
  const spentBefore = await db.spendSince(DAY_MS);
  const openMarkets = (await db.openMarketIds()).length;

  after(async () => {
    try {
      const result = await runCronCycle();
      console.log("[cron] cycle finished", JSON.stringify(result));
    } catch (err) {
      console.error("[cron] cycle failed:", err);
    }
  });

  return NextResponse.json(
    {
      ok: true,
      mode: "scheduled",
      at: new Date().toISOString(),
      intervalMinutes: cfg.oracleIntervalMinutes,
      willTick: Math.min(openMarkets, cfg.cronMarketsPerCycle),
      openMarkets,
      spentUsdcLast24h: spentBefore,
      capUsdc: cfg.cronDailyCapUsdc,
      note: "Cycle runs after this response. Check /ledger or /api/stats for results.",
    },
    { status: 202 }
  );
}
