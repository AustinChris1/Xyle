import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    activity: await db.listActivity(40),
    lastCronAt: await db.lastCronAt(),
  });
}
