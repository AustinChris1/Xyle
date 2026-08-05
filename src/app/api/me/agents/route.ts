import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validateCallbackUrl } from "@/lib/webhook-safety";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(48),
  callbackUrl: z.string().url(),
  maxUsdcPerDay: z.number().positive().max(100).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const profile = await db.ensureUser(session.address);
  return NextResponse.json({ agents: profile.agents });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = createSchema.parse(await req.json());

    // The server fetches this URL later, so reject anything pointing inward
    // before it is ever stored.
    const safe = validateCallbackUrl(body.callbackUrl);
    if (!safe.ok) {
      return NextResponse.json(
        { error: "INVALID_CALLBACK", detail: safe.reason },
        { status: 400 }
      );
    }

    const agent = await db.addAgent(session.address, {
      ...body,
      callbackUrl: safe.url,
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", detail: "name + https callbackUrl required" },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : "AGENT_FAILED";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }
  const profile = await db.removeAgent(session.address, id);
  return NextResponse.json({ agents: profile.agents });
}
