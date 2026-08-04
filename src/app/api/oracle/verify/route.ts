import { NextResponse } from "next/server";
import { z } from "zod";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { verifyClaim } from "@/lib/oracle";
import { clientIp, takeToken } from "@/lib/rate-limit";
import { TelegraphError } from "@/lib/telegraph/clients";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public infrastructure endpoint.
 * POST { "claim": "..." } → multi-miner fusion with per-stage receipts.
 *
 * Each call spends real USDC, so it is throttled per IP and capped against a
 * rolling 24h spend budget read from the shared ledger.
 */
const schema = z.object({
  claim: z.string().min(20).max(2000),
});

export async function POST(req: Request) {
  const cfg = loadConfig();

  const gate = takeToken(`verify:${clientIp(req)}`, cfg.verifyPerIpHourly);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        detail: `This endpoint pays miners per call, so it is limited to ${cfg.verifyPerIpHourly} requests per hour.`,
        retryAfterSeconds: gate.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
    );
  }

  const spent = await db.spendSince(DAY_MS);
  if (spent >= cfg.verifyDailyCapUsdc) {
    return NextResponse.json(
      {
        error: "DAILY_BUDGET_REACHED",
        detail: `The oracle has spent its ${cfg.verifyDailyCapUsdc} USDC daily budget. It resets on a rolling 24 hour window.`,
        spentUsdc: spent,
      },
      { status: 429 }
    );
  }

  try {
    const body = schema.parse(await req.json());
    const result = await verifyClaim(body.claim);

    return NextResponse.json({
      ok: true,
      product: "signal-arena-oracle",
      version: 1,
      result,
      budget: {
        spentUsdcLast24h:
          Math.round((spent + result.costUsdcEstimate) * 10000) / 10000,
        capUsdc: cfg.verifyDailyCapUsdc,
      },
      docs: "POST /api/oracle/verify with { claim }. Pays up to 4 miners: evidence, authenticity, judge A, judge B.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          detail: "Body must be { claim: string } with 20 to 2000 characters.",
        },
        { status: 400 }
      );
    }
    if (err instanceof TelegraphError) {
      return NextResponse.json(
        { error: err.code, detail: err.message },
        { status: err.status ?? 502 }
      );
    }
    return NextResponse.json(
      {
        error: "VERIFY_FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json({
    endpoint: "POST /api/oracle/verify",
    body: { claim: "string, 20 to 2000 characters" },
    stages: [
      `evidence (miner ${cfg.newsMinerId}, falls back to ${cfg.newsMinerAltId})`,
      `authenticity (miner ${cfg.authMinerId}, falls back to a local heuristic)`,
      `judge A (miner ${cfg.reasonMinerId})`,
      `judge B (miner ${cfg.consensusMinerId})`,
    ],
    settlement_rule:
      "YES only if both judges agree, confidence clears the threshold, authenticity is not synthetic, and corroborating coverage was found.",
    degradation:
      "A stage that fails is reported in result.stages.degraded rather than failing the request. A reading with a missing judge cannot return YES.",
    limits: {
      perIpHourly: cfg.verifyPerIpHourly,
      dailyBudgetUsdc: cfg.verifyDailyCapUsdc,
      approxCostPerCallUsdc: cfg.costUsdcPerCall,
    },
  });
}
