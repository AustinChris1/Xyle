import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  player: z.string().min(1).max(32),
  side: z.enum(["yes", "no"]),
  amount: z.number().positive().max(100),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const body = schema.parse(await req.json());
    const stake = await db.addStake({ marketId: id, ...body });
    const market = await db.getMarket(id);
    return NextResponse.json({ stake, market });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "STAKE_FAILED";
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    const status =
      msg === "MARKET_NOT_FOUND"
        ? 404
        : msg === "MARKET_CLOSED" ||
            msg === "MARKET_EXPIRED" ||
            msg === "INVALID_AMOUNT"
          ? 400
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
