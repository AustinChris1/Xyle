import { loadConfig } from "../config";
import { db } from "../db";
import type { MinerProbe } from "../types";
import {
  deepProbeableMiners,
  fetchCatalog,
  guessModel,
  routableMiners,
  type CatalogMiner,
} from "./catalog";
import { withCallContext } from "./call-context";
import { createPaymentFetch } from "./x402";

/**
 * Health probing for the miner catalog.
 *
 * Two depths, because they cost very different amounts:
 *
 * - **Routability** is free. Send an unpaid request; a `402 Payment Required`
 *   proves the node still dispatches to that miner. Every miner, every cycle.
 * - **Liveness** costs ~0.01 USDC. Actually pay and see whether the upstream
 *   answers. Only a rotating handful per cycle, because paying for all 38
 *   hourly would drain a faucet wallet in a day.
 *
 * The distinction matters: miner 109 returned 402 happily for weeks while its
 * upstream Gemini quota was exhausted. Routable is not the same as working.
 */

const ROUTABLE_TIMEOUT_MS = 8000;
const DEEP_TIMEOUT_MS = 45000;

function minerUrl(miner: CatalogMiner, path: string) {
  const cfg = loadConfig();
  return `${cfg.telegraphBaseUrl}${cfg.minerDispatcherPrefix}/${miner.id}${path}`;
}

function primaryPath(miner: CatalogMiner) {
  const chat = miner.endpoints.find((e) => e.path === "/chat");
  const search = miner.endpoints.find((e) => e.path === "/search");
  return chat?.path ?? search?.path ?? miner.endpoints[0]?.path ?? "/chat";
}

/** Free: does the node still route to this miner? */
export async function probeRoutable(miner: CatalogMiner): Promise<MinerProbe> {
  const started = Date.now();
  const path = primaryPath(miner);
  try {
    const res = await fetch(minerUrl(miner, path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(ROUTABLE_TIMEOUT_MS),
    });

    // 402 is the healthy answer here: the dispatcher found the miner and is
    // asking to be paid. 200 without payment is fine too.
    const ok = res.status === 402 || res.ok;
    return {
      minerId: miner.id,
      slug: miner.slug,
      name: miner.name,
      at: new Date().toISOString(),
      ok,
      paid: false,
      latencyMs: Date.now() - started,
      status: res.status,
      error: ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      minerId: miner.id,
      slug: miner.slug,
      name: miner.name,
      at: new Date().toISOString(),
      ok: false,
      paid: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 120) : "unreachable",
    };
  }
}

/** Paid: does the upstream behind the miner actually answer? */
export async function probeDeep(miner: CatalogMiner): Promise<MinerProbe> {
  const started = Date.now();
  const path = primaryPath(miner);
  const model = guessModel(miner);

  const body =
    path === "/search"
      ? { query: "bitcoin", q: "bitcoin", max_results: 1 }
      : {
          model,
          messages: [
            { role: "system", content: "Reply with only the word OK." },
            { role: "user", content: "ping" },
          ],
          max_tokens: 8,
          temperature: 0,
        };

  try {
    const pay = await createPaymentFetch();
    const res = await pay(minerUrl(miner, path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEEP_TIMEOUT_MS),
    });

    const text = await res.text().catch(() => "");
    return {
      minerId: miner.id,
      slug: miner.slug,
      name: miner.name,
      at: new Date().toISOString(),
      ok: res.ok,
      paid: true,
      latencyMs: Date.now() - started,
      status: res.status,
      error: res.ok ? undefined : text.slice(0, 160).replace(/\s+/g, " "),
    };
  } catch (err) {
    return {
      minerId: miner.id,
      slug: miner.slug,
      name: miner.name,
      at: new Date().toISOString(),
      ok: false,
      paid: true,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 160) : "failed",
    };
  }
}

/**
 * One Pulse cycle: routability for everyone, deep probe for a rotating slice.
 * Rotation is by hour so coverage is even without storing a cursor.
 */
export async function runPulseCycle(): Promise<{
  routable: number;
  routableTotal: number;
  deepProbed: string[];
  costUsdc: number;
}> {
  const cfg = loadConfig();
  const catalog = await fetchCatalog();
  const routeTargets = routableMiners(catalog);
  const deepPool = deepProbeableMiners(catalog);

  if (routeTargets.length === 0) {
    return { routable: 0, routableTotal: 0, deepProbed: [], costUsdc: 0 };
  }

  /**
   * A rotating window, not the whole catalog.
   *
   * This used to sweep all 130 integrations every cycle. Free per request, but
   * on an hourly schedule that is over three thousand automated calls a day to
   * a shared node, and the Telegraph team asked participants to stop exactly
   * this. Rotating keeps every miner covered within a few cycles at a small
   * fraction of the traffic.
   */
  const perSweep = Math.max(1, cfg.pulseRoutablePerCycle);
  const rOffset =
    (Math.floor(Date.now() / 3_600_000) * perSweep) % Math.max(1, routeTargets.length);
  const sweep = Array.from(
    { length: Math.min(perSweep, routeTargets.length) },
    (_, i) => routeTargets[(rOffset + i) % routeTargets.length]!
  );

  const routableProbes: MinerProbe[] = [];
  const BATCH = 4;
  for (let i = 0; i < sweep.length; i += BATCH) {
    const slice = sweep.slice(i, i + BATCH);
    routableProbes.push(...(await Promise.all(slice.map(probeRoutable))));
  }

  // Paid pass over a rotating window of the miners we can actually call.
  const perCycle = Math.max(0, cfg.pulseDeepPerCycle);
  const offset =
    (Math.floor(Date.now() / 3_600_000) * perCycle) % Math.max(1, deepPool.length);
  const deepTargets = deepPool.length
    ? Array.from({ length: Math.min(perCycle, deepPool.length) }, (_, i) =>
        deepPool[(offset + i) % deepPool.length]!
      )
    : [];

  const deepProbes: MinerProbe[] = [];
  for (const m of deepTargets) {
    deepProbes.push(await probeDeep(m));
  }

  await db.recordProbes([...routableProbes, ...deepProbes]);

  return {
    routable: routableProbes.filter((p) => p.ok).length,
    routableTotal: routableProbes.length,
    deepProbed: deepTargets.map((m) => m.id),
    costUsdc:
      deepProbes.filter((p) => p.ok).length * loadConfig().costUsdcPerCall,
  };
}

/** Tags Pulse spend in the ledger context when a deep probe pays. */
export function withPulseContext<T>(fn: () => Promise<T>) {
  return withCallContext({ context: "pulse:probe" }, fn);
}
