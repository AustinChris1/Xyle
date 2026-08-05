import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildTestPayload, deliverWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  /** Omit to test the profile's personal webhook. */
  agentId: z.string().optional(),
});

/**
 * Sends a sample event to a registered endpoint so it can be verified without
 * waiting for a real settlement, which may be hours away.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = schema.parse(await req.json().catch(() => ({})));
  const profile = await db.ensureUser(session.address);

  let target: string | undefined;
  let label: string;

  if (body.agentId) {
    const agent = profile.agents.find((a) => a.id === body.agentId);
    if (!agent) {
      return NextResponse.json({ error: "AGENT_NOT_FOUND" }, { status: 404 });
    }
    target = agent.callbackUrl;
    label = agent.name;
  } else {
    target = profile.webhookUrl;
    label = "Personal webhook";
  }

  if (!target) {
    return NextResponse.json(
      {
        error: "NO_TARGET",
        detail: "Save a personal webhook URL first, then send a test.",
      },
      { status: 400 }
    );
  }

  const result = await deliverWebhook(target, buildTestPayload(body.agentId));

  await db.pushUserAlert(session.address, {
    kind: "agent_delivery",
    title: result.ok
      ? `Test event delivered to ${label}`
      : `Test event to ${label} failed`,
    detail: result.ok
      ? `HTTP ${result.status ?? 200}`
      : result.error || `HTTP ${result.status ?? "no response"}`,
    href: "/desk",
  });

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    error: result.error,
    sentTo: target,
  });
}
