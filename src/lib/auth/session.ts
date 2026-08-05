import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  address?: string;
  handle?: string;
  chainId?: number;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET?.trim() ||
    // Dev fallback only; set SESSION_SECRET in production.
    "signal-arena-dev-session-secret-min-32-chars!!",
  cookieName: "sa_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.address) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

/** In-memory nonces for SIWE (fine for single-instance / demo). */
const nonces = new Map<string, number>();

export function issueNonce(): string {
  const nonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  nonces.set(nonce, Date.now());
  // prune old
  if (nonces.size > 500) {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [k, t] of nonces) {
      if (t < cutoff) nonces.delete(k);
    }
  }
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const t = nonces.get(nonce);
  if (!t) return false;
  nonces.delete(nonce);
  return Date.now() - t < 10 * 60 * 1000;
}
