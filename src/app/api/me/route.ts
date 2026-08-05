import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validateCallbackUrl } from "@/lib/webhook-safety";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const desk = await db.deskFor(session.address);
  return NextResponse.json(desk);
}

const patchSchema = z.object({
  handle: z.string().min(1).max(32).optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  watchlistKeywords: z.array(z.string()).max(20).optional(),
  markAlertsRead: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = patchSchema.parse(await req.json());

    // Same SSRF guard as agent callbacks: the server fetches this URL later.
    let webhookUrl = body.webhookUrl;
    if (webhookUrl) {
      const safe = validateCallbackUrl(webhookUrl);
      if (!safe.ok) {
        return NextResponse.json(
          { error: "INVALID_WEBHOOK", detail: safe.reason },
          { status: 400 }
        );
      }
      webhookUrl = safe.url;
    }

    if (body.markAlertsRead) {
      await db.markAlertsRead(session.address);
    }
    const profile = await db.updateUser(session.address, {
      handle: body.handle,
      webhookUrl,
      watchlistKeywords: body.watchlistKeywords,
    });
    session.handle = profile.handle;
    await session.save();
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
    }
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}
