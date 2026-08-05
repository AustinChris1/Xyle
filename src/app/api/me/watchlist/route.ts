import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  marketId: z.string().min(3),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const market = await db.getMarket(body.marketId);
    if (!market) {
      return NextResponse.json({ error: "MARKET_NOT_FOUND" }, { status: 404 });
    }
    const profile = await db.toggleWatchMarket(session.address, body.marketId);
    return NextResponse.json({
      watching: profile.watchlistMarketIds.includes(body.marketId),
      watchlistMarketIds: profile.watchlistMarketIds,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
    }
    return NextResponse.json({ error: "WATCH_FAILED" }, { status: 500 });
  }
}
