import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ nonce: issueNonce() });
}
