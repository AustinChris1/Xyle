import { loadConfig } from "../config";

/**
 * The node's integration catalog, cached in module memory.
 *
 * Pulse needs the full miner list on every page render and probe cycle, and
 * the catalog changes rarely, so refetching it per request would be pure
 * latency. Failures return the last good copy rather than an empty list, so a
 * blip on the node does not blank the status page.
 */

export interface CatalogMiner {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string;
  endpoints: Array<{ path: string; method: string; description?: string }>;
  minPriceUsdc?: number;
  activationStatus?: string;
  totalRequestsServed?: number;
  /** Model ids the miner documents, parsed from its input schema when present. */
  modelHint?: string;
}

let cache: { at: number; miners: CatalogMiner[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function fetchCatalog(force = false): Promise<CatalogMiner[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.miners;

  const cfg = loadConfig();
  try {
    const res = await fetch(
      `${cfg.telegraphBaseUrl}/miner-dispatcher/integrations`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);

    const raw = (await res.json()) as unknown;
    const list = Array.isArray(raw) ? raw : [];

    const miners: CatalogMiner[] = list.map((m) => {
      const x = m as Record<string, unknown>;
      const schema = x.input_schema as
        | { properties?: { model?: { description?: string } } }
        | undefined;
      return {
        id: String(x.id ?? ""),
        slug: String(x.slug ?? x.id ?? ""),
        name: String(x.name ?? x.slug ?? `Miner ${x.id}`),
        kind: String(x.kind ?? "miner"),
        description: String(x.description ?? ""),
        endpoints: Array.isArray(x.endpoints)
          ? (x.endpoints as CatalogMiner["endpoints"])
          : [],
        minPriceUsdc:
          typeof x.min_price_usdc === "number"
            ? x.min_price_usdc / 1_000_000
            : undefined,
        activationStatus: x.activation_status as string | undefined,
        totalRequestsServed: x.total_requests_served as number | undefined,
        modelHint: schema?.properties?.model?.description,
      };
    });

    cache = { at: Date.now(), miners };
    return miners;
  } catch (err) {
    console.warn(
      "[catalog] fetch failed:",
      err instanceof Error ? err.message : err
    );
    return cache?.miners ?? [];
  }
}

/**
 * Routability works on any endpoint: we POST and a 402 proves dispatch. So
 * this covers the whole catalog, not just the shapes we know how to call.
 */
export function routableMiners(miners: CatalogMiner[]): CatalogMiner[] {
  return miners.filter((m) => m.endpoints.length > 0);
}

/**
 * Deep probes have to send a body the miner will accept, so they are limited
 * to the two shapes we understand.
 */
export function deepProbeableMiners(miners: CatalogMiner[]): CatalogMiner[] {
  return miners.filter((m) =>
    m.endpoints.some((e) => e.path === "/chat" || e.path === "/search")
  );
}

/**
 * Best guess at a model id the miner will accept.
 * The catalog's own descriptions are not reliable (miner 110 claims ":free
 * only" yet serves gpt-4o-mini), so this is a hint, not a contract.
 */
export function guessModel(m: CatalogMiner): string | undefined {
  const hint = m.modelHint ?? "";
  const explicit = hint.match(/\b([a-z0-9][\w.\-]*(?:\/[\w.\-:]+)?)\b(?=\s*(?:or|,|\.|$))/i);

  const known: Record<string, string> = {
    openrouter: "openai/gpt-4o-mini",
    litellm: "nova-2-lite",
    gemini: "gemini-flash-latest",
    "bedrock-nova-2-lite": "nova-2-lite",
    "bedrock-deepseek": "deepseek",
    "bedrock-qwen": "qwen",
    "bedrock-kimi": "kimi",
    "bedrock-voxtral": "voxtral",
    "bedrock-nova-pro": "nova-pro",
  };
  if (known[m.slug]) return known[m.slug];

  const first = hint.match(/:\s*([\w.\-/]+)/);
  return first?.[1] ?? explicit?.[1];
}
