import { NextResponse } from "next/server";
import { z } from "zod";
import { createMarketFromHeadline } from "@/lib/markets-from-headline";
import { TelegraphError } from "@/lib/telegraph/clients";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  headline: z.string().min(12).max(400),
  player: z.string().min(1).max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const market = await createMarketFromHeadline(body.headline, body.player);
    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", detail: "headline must be 12-400 characters" },
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
        error: "CREATE_FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
