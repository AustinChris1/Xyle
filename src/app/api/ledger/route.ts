import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Math.min(
    200,
    Number(new URL(req.url).searchParams.get("limit") ?? 80) || 80
  );
  const [entries, byMiner, totalCalls, totalCost] = await Promise.all([
    db.listConsumption(limit),
    db.consumptionByMiner(),
    db.minerRequests(),
    db.totalCostUsdc(),
  ]);
  return NextResponse.json({
    totalCalls,
    totalCostUsdc: totalCost,
    byMiner,
    entries,
  });
}
