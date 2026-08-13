import { createHmac } from "node:crypto";

/**
 * Callback URLs are attacker-supplied and the server fetches them, so they are
 * an SSRF vector: without this, anyone could point an agent at
 * http://169.254.169.254/ and have the server fetch cloud metadata for them.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) {
    return true;
  }

  // IPv4 literals in private / link-local / loopback ranges
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
    if (a >= 224) return true; // multicast and reserved
  }

  // IPv6 loopback / unique-local / link-local
  if (h.startsWith("[")) {
    const inner = h.slice(1, -1);
    if (inner === "::1" || inner.startsWith("fc") || inner.startsWith("fd")) {
      return true;
    }
    if (inner.startsWith("fe80")) return true;
  }

  return false;
}

export function validateCallbackUrl(raw: string):
  | { ok: true; url: string }
  | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  const allowInsecure = process.env.ALLOW_INSECURE_WEBHOOKS === "true";
  if (parsed.protocol !== "https:" && !allowInsecure) {
    return { ok: false, reason: "Callback URLs must use https." };
  }

  if (isPrivateHost(parsed.hostname) && !allowInsecure) {
    return {
      ok: false,
      reason: "Callback URLs must point at a public host.",
    };
  }

  return { ok: true, url: parsed.toString() };
}

/**
 * Lets a receiver prove the POST came from this app.
 * Header: X-Xyle-Signature: sha256=<hex of hmac over the raw body>
 */
export function signPayload(body: string): string | undefined {
  const secret =
    process.env.WEBHOOK_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret) return undefined;
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}
