import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { runChallenge } from "@/lib/oracle";
import { TelegraphError } from "@/lib/telegraph/clients";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  player: z.string().min(1).max(32).optional(),
  text: z.string().min(80).max(4000),
});

export async function GET() {
  return NextResponse.json({
    attempts: (await db.listChallenges()).slice(0, 50),
  });
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const session = await getSession();
    const player =
      (session.isLoggedIn && session.handle) ||
      body.player?.trim() ||
      "anon";
    const address = session.isLoggedIn ? session.address : undefined;

    const attempt = await runChallenge(player, body.text, address);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const textIssue = err.issues.find((i) => i.path.includes("text"));
      const detail =
        textIssue?.code === "too_small"
          ? `Claim is too short. Write at least 80 characters (you sent fewer). Longer copy is harder to dismiss as a joke and better for scoring.`
          : err.issues.map((i) => i.message).join("; ") || "Invalid input";
      return NextResponse.json(
        { error: "VALIDATION_ERROR", detail },
        { status: 400 }
      );
    }
    if (err instanceof TelegraphError) {
      return NextResponse.json(
        { error: err.code, detail: err.message },
        { status: err.status ?? 502 }
      );
    }
    return NextResponse.json(
      {
        error: "CHALLENGE_FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
