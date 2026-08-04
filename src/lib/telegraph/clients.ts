import { loadConfig } from "../config";
import { db } from "../db";
import type { PaymentProof, ProofRole } from "../types";
import { currentCallContext } from "./call-context";
import { createPaymentFetch, withTxCapture, type PaymentCapture } from "./x402";

export class TelegraphError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    /** Which miner failed, so callers can degrade rather than abort. */
    public readonly stage?: { minerId: string; label: string; role: ProofRole }
  ) {
    super(message);
    this.name = "TelegraphError";
  }
}

/**
 * Writes one ledger row per attempt, the moment it resolves.
 *
 * This runs inside `minerRequest` rather than at the end of a pipeline on
 * purpose: a reading that dies at stage two has still spent real USDC at
 * stage one, and the public ledger has to show it.
 */
async function recordAttempt(input: {
  minerId: string;
  label: string;
  role: ProofRole;
  latencyMs: number;
  success: boolean;
  mocked: boolean;
  txHash?: string;
}) {
  const { context, marketId } = currentCallContext();
  try {
    await db.recordCall({
      minerId: input.minerId,
      label: input.label,
      role: input.role,
      latencyMs: input.latencyMs,
      // Failed upstream calls are not settled by the facilitator, so they cost
      // nothing. They still belong on the ledger as reliability data.
      costUsdc:
        input.success && !input.mocked ? loadConfig().costUsdcPerCall : 0,
      mocked: input.mocked,
      txHash: input.txHash,
      context,
      marketId,
      success: input.success,
    });
  } catch (err) {
    console.warn("[ledger] could not record call:", (err as Error).message);
  }
}

function minerUrl(minerId: string, path: string) {
  const cfg = loadConfig();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${cfg.telegraphBaseUrl}${cfg.minerDispatcherPrefix}/${minerId}${p}`;
}

function roleToLegacy(role: ProofRole): PaymentProof["subnet"] {
  if (role === "authenticity") return "itsai";
  if (role === "news") return "desearch";
  // reason + consensus map to legacy "groq" bucket for old UI keys
  return "groq";
}

async function minerRequest(
  minerId: string,
  path: string,
  method: "GET" | "POST",
  body: unknown | undefined,
  role: ProofRole,
  label: string
): Promise<{ data: unknown; proof: PaymentProof }> {
  const cfg = loadConfig();
  let url = minerUrl(minerId, path);
  const capture: PaymentCapture = {};
  const baseFetch = await createPaymentFetch();
  const paymentFetch = withTxCapture(baseFetch, capture);
  const started = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const init: RequestInit = {
      method,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    };

    if (method === "GET" && body && typeof body === "object") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const s = qs.toString();
      if (s) url += `?${s}`;
    } else if (method === "POST") {
      init.headers = {
        ...init.headers,
        "Content-Type": "application/json",
      };
      init.body = JSON.stringify(body ?? {});
    }

    const res = await paymentFetch(url, init);
    const latencyMs = Date.now() - started;

    const stage = { minerId, label, role };

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[miner] ${label} ${method} ${url} -> ${res.status} ${text.slice(0, 200)}`
      );
      await recordAttempt({
        minerId,
        label,
        role,
        latencyMs,
        success: false,
        mocked: false,
      });

      if (res.status === 402) {
        throw new TelegraphError(
          "The settlement wallet could not pay for this reading. Try again shortly.",
          "PAYMENT_REQUIRED",
          402,
          stage
        );
      }
      if (res.status === 404) {
        throw new TelegraphError(
          "One of the settlement stages is unavailable right now.",
          "STAGE_UNAVAILABLE",
          404,
          stage
        );
      }
      throw new TelegraphError(
        "A settlement stage returned an error. Try the reading again.",
        "STAGE_ERROR",
        res.status,
        stage
      );
    }

    const data = await res.json();
    await recordAttempt({
      minerId,
      label,
      role,
      latencyMs,
      success: true,
      mocked: false,
      txHash: capture.txHash,
    });

    return {
      data,
      proof: {
        subnet: roleToLegacy(role),
        role,
        minerId,
        label,
        mocked: false,
        txHash: capture.txHash,
        latencyMs,
        costUsdc: cfg.costUsdcPerCall,
      },
    };
  } catch (err) {
    if (err instanceof TelegraphError) throw err;
    const e = err as Error;
    const stage = { minerId, label, role };
    console.warn(`[miner] ${label} failed: ${e.message}`);
    await recordAttempt({
      minerId,
      label,
      role,
      latencyMs: Date.now() - started,
      success: false,
      mocked: false,
    });

    if (e.name === "AbortError") {
      throw new TelegraphError(
        "A settlement stage took too long to respond. Try the reading again.",
        "TIMEOUT",
        503,
        stage
      );
    }
    throw new TelegraphError(
      "Could not reach a settlement stage. Try the reading again.",
      "NETWORK",
      502,
      stage
    );
  } finally {
    clearTimeout(timeout);
  }
}

function mockProof(
  role: ProofRole,
  label: string,
  minerId?: string
): PaymentProof {
  return {
    subnet: roleToLegacy(role),
    role,
    minerId,
    label,
    mocked: true,
    latencyMs: 40 + Math.floor(Math.random() * 80),
    costUsdc: 0,
  };
}

/** Heuristic wire-copy / LLM-slop signals (boosts authenticity score). */
function heuristicAiScore(text: string): number {
  let s = 0;
  if (/^BREAKING:/im.test(text)) s += 0.25;
  if (/\b(multiple independent|reportedly|sources say|it is important to note)\b/i.test(text))
    s += 0.15;
  if (/\b(delve|landscape|leverage|revolutionize|cutting-edge|robust)\b/i.test(text))
    s += 0.2;
  if (/\b\$\d+(\.\d+)?[MBK]\b/.test(text) && /protocol|exploit|hack/i.test(text))
    s += 0.1;
  if (text.length > 500 && !/[!?]{2,}|\bI\b|\bwe\b/.test(text)) s += 0.05;
  return Math.min(0.55, s);
}

/**
 * Authenticity stage: a paid miner call with a strict detector prompt,
 * blended with local heuristics so obvious wire-copy templates do not slip by.
 */
export async function detectAiText(text: string): Promise<{
  answer: 0 | 1;
  score: number;
  proof: PaymentProof | null;
  detail: string;
  degraded: boolean;
}> {
  const cfg = loadConfig();
  if (cfg.mockMode) {
    const h = heuristicAiScore(text);
    const score = Math.max(h, /as an ai|delve/i.test(text) ? 0.8 : 0.25);
    return {
      answer: score > 0.55 ? 1 : 0,
      score,
      proof: mockProof("authenticity", "Simulated authenticity"),
      detail:
        score > 0.55
          ? "Simulated check: reads as synthetic"
          : "Simulated check: reads as human written",
      degraded: false,
    };
  }

  const h = heuristicAiScore(text);

  let data: unknown;
  let proof: PaymentProof;
  try {
    ({ data, proof } = await minerRequest(
      cfg.authMinerId,
      cfg.authPath,
      "POST",
      {
        model: cfg.authModel,
        messages: [
          {
            role: "system",
            content: `You are a strict AI-writing detector for a prediction oracle.
Score whether the text is synthetic, AI-generated, or classic "wire copy" spam designed to fake news.

Red flags: BREAKING: openers, round dollar amounts with no named source, "multiple independent firms" without names, generic DeFi exploit templates, no links/dates/org names, polished urgency without attribution.

Return ONLY JSON:
{"verdict":"yes"|"no","confidence":0-1,"reasoning":"one sentence"}
- verdict yes = AI / synthetic / farmed
- verdict no = likely human reporting
Be skeptical of dramatic unattributed claims.`,
        },
          { role: "user", content: text.slice(0, 3500) },
        ],
        max_tokens: 200,
        temperature: 0.1,
      },
      "authenticity",
      `${cfg.authLabel} ${cfg.authMinerId} authenticity`
    ));
  } catch (err) {
    // The detector miner is down. Rather than sink the whole reading, fall
    // back to the local heuristic and mark the stage degraded so the UI and
    // the API response both say so.
    console.warn(
      `[authenticity] miner ${cfg.authMinerId} unavailable, using heuristic:`,
      err instanceof Error ? err.message : err
    );
    const isAi = h >= 0.35;
    return {
      answer: isAi ? 1 : 0,
      score: h,
      proof: null,
      detail: `Detector miner unavailable, scored by local heuristic only (${h.toFixed(2)})`,
      degraded: true,
    };
  }

  const raw = extractChatContent(data);
  const parsed = parseJsonLoose(raw);
  let confidence = clamp01(Number(parsed.confidence) || 0.5);
  let isAi =
    String(parsed.verdict || "").toLowerCase() === "yes" ||
    String(parsed.verdict || "").toLowerCase() === "ai";

  // Blend heuristics so classic synthetic "BREAKING" samples do not walk through
  confidence = Math.min(1, Math.max(confidence, h + (isAi ? 0.15 : 0)));
  if (h >= 0.35 && confidence >= 0.5) isAi = true;

  return {
    answer: isAi ? 1 : 0,
    score: confidence,
    proof,
    detail: isAi
      ? `Authenticity check: reads as synthetic, score ${confidence.toFixed(2)}`
      : `Authenticity check: reads as human written, score ${confidence.toFixed(2)}`,
    degraded: false,
  };
}

export interface NewsArticle {
  title: string;
  snippet: string;
  url?: string;
}

/** Evidence stage. Primary news miner, alternate miner as fallback. */
export async function searchNews(query: string): Promise<{
  articles: NewsArticle[];
  proof: PaymentProof | null;
  degraded: boolean;
}> {
  const cfg = loadConfig();
  if (cfg.mockMode) {
    return {
      articles: [
        {
          title: "Simulated coverage",
          snippet: `Placeholder result for: ${query}`,
        },
      ],
      proof: mockProof("news", "Simulated evidence"),
      degraded: false,
    };
  }

  try {
    const { data, proof } = await minerRequest(
      cfg.newsMinerId,
      cfg.newsPath,
      "POST",
      {
        query,
        max_results: 5,
        include_answer: true,
        topic: "news",
        search_depth: "basic",
      },
      "news",
      `${cfg.newsLabel} ${cfg.newsMinerId}`
    );

    const body = data as {
      answer?: string;
      results?: Array<{
        title?: string;
        content?: string;
        url?: string;
      }>;
    };

    const articles: NewsArticle[] =
      body.results?.slice(0, 5).map((r, i) => ({
        title: r.title?.trim() || `Source ${i + 1}`,
        snippet: (r.content || body.answer || "").slice(0, 320),
        url: r.url,
      })) ?? [];

    if (body.answer && articles.length === 0) {
      articles.push({
        title: "Search synthesis",
        snippet: body.answer.slice(0, 320),
      });
    }

    if (articles.length > 0) return { articles, proof, degraded: false };
  } catch (err) {
    console.warn(
      `[news] miner ${cfg.newsMinerId} failed, trying ${cfg.newsMinerAltId}:`,
      err instanceof Error ? err.message : err
    );
  }

  try {
    const { data, proof } = await minerRequest(
      cfg.newsMinerAltId,
      "/search",
      "GET",
      { q: query },
      "news",
      `${cfg.newsAltLabel} ${cfg.newsMinerAltId}`
    );

    const body = data as {
      articles?: Array<{
        title?: string;
        description?: string;
        content?: string;
        url?: string;
      }>;
    };

    const articles: NewsArticle[] =
      body.articles?.slice(0, 5).map((a, i) => ({
        title: a.title?.trim() || `Article ${i + 1}`,
        snippet: (a.description || a.content || "").slice(0, 320),
        url: a.url,
      })) ?? [];

    return { articles, proof, degraded: articles.length === 0 };
  } catch (err) {
    // Both evidence miners are down. The judges still run, but with nothing
    // to corroborate they cannot produce a YES, which is the safe outcome.
    console.warn(
      "[news] both evidence miners unavailable:",
      err instanceof Error ? err.message : err
    );
    return { articles: [], proof: null, degraded: true };
  }
}

type ReasonOpts = {
  minerId: string;
  path: string;
  model: string;
  label: string;
  role?: ProofRole;
};

/** Settlement reasoning on a specific miner (for dual-judge consensus). */
export async function reasonJson(
  system: string,
  user: string,
  opts?: Partial<ReasonOpts>
) {
  const cfg = loadConfig();
  const minerId = opts?.minerId ?? cfg.reasonMinerId;
  const path = opts?.path ?? cfg.reasonPath;
  const model = opts?.model ?? cfg.reasonModel;
  const label = opts?.label ?? `${cfg.reasonLabel} ${minerId} judge A`;
  const role = opts?.role ?? "reason";

  if (cfg.mockMode) {
    return {
      verdict: "uncertain" as const,
      confidence: 0.5,
      reasoning:
        "Running in simulation mode, so no live evidence was gathered for this reading.",
      proof: mockProof(role, `Simulated ${label}`, minerId),
    };
  }

  const { data, proof } = await minerRequest(
    minerId,
    path,
    "POST",
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 280,
      temperature: 0.1,
    },
    role,
    label
  );

  const cleaned = extractChatContent(data);
  const parsed = parseJsonLoose(cleaned);
  const v = String(parsed.verdict ?? "uncertain").toLowerCase();
  const verdict: "yes" | "no" | "uncertain" =
    v === "yes" || v === "no" ? v : "uncertain";
  const conf = Number(parsed.confidence);

  return {
    verdict,
    confidence: Number.isFinite(conf) ? clamp01(conf) : 0.5,
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : cleaned.slice(0, 400) || "Unparseable LLM response",
    proof,
  };
}

/** Second independent judge (LiteLLM / Nova) for consensus. */
export async function reasonJsonConsensus(system: string, user: string) {
  const cfg = loadConfig();
  return reasonJson(system, user, {
    minerId: cfg.consensusMinerId,
    path: cfg.consensusPath,
    model: cfg.consensusModel,
    label: `${cfg.consensusLabel} ${cfg.consensusMinerId} judge B`,
    role: "consensus",
  });
}

/** Free-form JSON object from a chat miner (market factory, etc.). */
export async function chatJsonObject(
  system: string,
  user: string
): Promise<{ data: Record<string, unknown>; proof: PaymentProof }> {
  const cfg = loadConfig();
  if (cfg.mockMode) {
    return {
      data: { markets: [] },
      proof: mockProof("reason", "Simulated factory", cfg.reasonMinerId),
    };
  }
  const { data, proof } = await minerRequest(
    cfg.reasonMinerId,
    cfg.reasonPath,
    "POST",
    {
      model: cfg.reasonModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 500,
      temperature: 0.2,
    },
    "reason",
    `${cfg.reasonLabel} ${cfg.reasonMinerId} market factory`
  );
  const cleaned = extractChatContent(data);
  return { data: parseJsonLoose(cleaned), proof };
}

function extractChatContent(data: unknown): string {
  const body = data as {
    choices?: Array<{ message?: { content?: string } }>;
    content?: string;
    message?: string;
    output?: string;
  };
  const raw =
    body.choices?.[0]?.message?.content ??
    body.content ??
    body.message ??
    body.output ??
    (typeof data === "string" ? data : JSON.stringify(data));
  return String(raw)
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** Free node health, cached ~30s to keep /api/stats snappy. */
let healthCache: {
  at: number;
  value: { ok: boolean; integrations: number; status?: unknown; error?: string };
} | null = null;

export async function nodeHealth(): Promise<{
  ok: boolean;
  integrations: number;
  status?: unknown;
  error?: string;
}> {
  if (healthCache && Date.now() - healthCache.at < 30_000) {
    return healthCache.value;
  }

  const cfg = loadConfig();
  try {
    const [statusRes, intRes] = await Promise.all([
      fetch(`${cfg.telegraphBaseUrl}/status`, {
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${cfg.telegraphBaseUrl}/miner-dispatcher/integrations`, {
        signal: AbortSignal.timeout(12000),
      }),
    ]);
    const status = statusRes.ok ? await statusRes.json() : null;
    const integrations = intRes.ok ? await intRes.json() : [];
    const value = {
      ok: statusRes.ok,
      integrations: Array.isArray(integrations) ? integrations.length : 0,
      status,
    };
    healthCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    const value = {
      ok: false,
      integrations: 0,
      error: err instanceof Error ? err.message : String(err),
    };
    healthCache = { at: Date.now(), value };
    return value;
  }
}
