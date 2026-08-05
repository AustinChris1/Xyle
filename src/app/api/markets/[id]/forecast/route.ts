import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  side: z.enum(["yes", "no"]),
});

/**
 * One forecast per wallet per market. Posting again replaces the previous
 * call while the market is open, so changing your mind is free but does not
 * let one person inflate the split.
 *
 * Sign-in is required precisely because that is what makes "one per person"
 * mean anything.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json(
      {
        error: "UNAUTHORIZED",
        detail: "Connect a wallet and sign in to record a forecast.",
      },
      { status: 401 }
    );
  }

  try {
    const body = schema.parse(await req.json());

    const forecast = await db.addForecast({
      marketId: id,
      player: session.handle || session.address.slice(0, 8),
      address: session.address,
      side: body.side,
    });

    const market = await db.getMarket(id);
    return NextResponse.json({ forecast, market });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", detail: "side must be yes or no" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "FORECAST_FAILED";
    const status =
      msg === "MARKET_NOT_FOUND"
        ? 404
        : msg === "MARKET_CLOSED" || msg === "MARKET_EXPIRED"
          ? 400
          : 500;
    const detail =
      msg === "MARKET_CLOSED" || msg === "MARKET_EXPIRED"
        ? "This market is no longer open for forecasts."
        : msg;
    return NextResponse.json({ error: msg, detail }, { status });
  }
}
