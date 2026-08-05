import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ isLoggedIn: false });
  }
  const profile = await db.ensureUser(session.address);
  return NextResponse.json({
    isLoggedIn: true,
    address: profile.address,
    handle: profile.handle,
    chainId: session.chainId,
    watchlistMarketIds: profile.watchlistMarketIds,
    unreadAlerts: profile.alerts.filter((a) => !a.read).length,
  });
}
