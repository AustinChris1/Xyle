import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await db.listMarkets();
  const enriched = await Promise.all(
    markets.map(async (m) => ({
      ...m,
      stakes: (await db.listStakes(m.id)).length,
      lastTick: (await db.listTicks(m.id))[0] ?? null,
    }))
  );
  return NextResponse.json({ markets: enriched });
}

const createSchema = z.object({
  title: z.string().min(8).max(200),
  description: z.string().min(20).max(2000),
  eventClass: z.string().min(2).max(64),
  searchQuery: z.string().min(3).max(200),
  confidenceThreshold: z.number().min(0.5).max(0.95).optional(),
  closesInHours: z.number().min(1).max(168).optional(),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const market = await db.createMarket(body);
    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
}
