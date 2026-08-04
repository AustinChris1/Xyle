import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runOracleTick } from "@/lib/oracle";
import { TelegraphError } from "@/lib/telegraph/clients";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const tick = await runOracleTick(id);
    const market = await db.getMarket(id);
    return NextResponse.json({ tick, market });
  } catch (err) {
    if (err instanceof TelegraphError) {
      return NextResponse.json(
        { error: err.code, detail: err.message },
        { status: err.status ?? 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "ORACLE_FAILED";
    const status =
      msg === "MARKET_NOT_FOUND" ? 404 : msg === "MARKET_NOT_OPEN" ? 400 : 500;
    return NextResponse.json(
      { error: msg, detail: err instanceof Error ? err.message : String(err) },
      { status }
    );
  }
}
