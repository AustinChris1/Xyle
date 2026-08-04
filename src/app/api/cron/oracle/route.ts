import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { runCronCycle } from "@/lib/oracle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Always-on cycle: auto-open markets from news + tick all open markets.
 * Vercel Cron every 15m, or cron-job.org → GET with Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  const cfg = loadConfig();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const urlSecret = new URL(req.url).searchParams.get("secret");

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

  try {
    const result = await runCronCycle();
    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      intervalMinutes: cfg.oracleIntervalMinutes,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
