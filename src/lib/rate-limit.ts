/**
 * Best-effort per-IP throttle for endpoints that spend real money.
 *
 * State is per instance, so a serverless fleet enforces this loosely. The
 * hard stop is the persisted 24h spend cap in the route, which every instance
 * reads from the same store.
 */

const HOUR_MS = 60 * 60 * 1000;

const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function takeToken(
  key: string,
  limit: number,
  windowMs = HOUR_MS
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    const oldest = recent[0]!;
    hits.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return { allowed: true, remaining: limit - recent.length, retryAfterSec: 0 };
}
