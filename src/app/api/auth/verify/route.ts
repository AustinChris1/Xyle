import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { consumeNonce, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(10),
  signature: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const siwe = new SiweMessage(body.message);

    if (!siwe.nonce || !consumeNonce(siwe.nonce)) {
      return NextResponse.json(
        { error: "INVALID_NONCE", detail: "Sign-in expired. Try again." },
        { status: 401 }
      );
    }

    // Accept domain from the message itself (local vs deploy) so SIWE is not
    // broken when NEXT_PUBLIC_APP_URL differs from the browser host.
    const domain = siwe.domain;

    const result = await siwe.verify({
      signature: body.signature,
      domain,
      nonce: siwe.nonce,
    });

    if (!result.success || !result.data.address) {
      return NextResponse.json(
        { error: "INVALID_SIGNATURE", detail: "Could not verify wallet signature." },
        { status: 401 }
      );
    }

    const address = result.data.address.toLowerCase();
    const profile = await db.ensureUser(address);

    const session = await getSession();
    session.address = address;
    session.handle = profile.handle;
    session.chainId = result.data.chainId;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      ok: true,
      address,
      handle: profile.handle,
      chainId: result.data.chainId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: "AUTH_FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 401 }
    );
  }
}
