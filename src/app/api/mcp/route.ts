import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { verifyClaim } from "@/lib/oracle";
import { clientIp, takeToken } from "@/lib/rate-limit";
import { fetchCatalog } from "@/lib/telegraph/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const PROTOCOL_VERSION = "2025-06-18";

/**
 * Minimal MCP server over streamable HTTP.
 *
 * Hand-rolled rather than pulling in an SDK: the surface is three tools and
 * JSON-RPC over POST, and a dependency here would outweigh the code it saves.
 *
 * The point is that an agent can verify a claim before acting on it, which is
 * the difference between "a website that checks facts" and "a guardrail other
 * software calls".
 */

const TOOLS = [
  {
    name: "verify_claim",
    description:
      "Check whether a factual claim is supported by recent evidence. Four independent Telegraph miners gather dated news, score it for synthetic text, and rule on it separately. Returns a verdict of yes, no, or uncertain with a confidence score, the sources it relied on, and a permalink. Costs about 0.04 USDC per call and takes roughly 40 seconds. Use this before acting on a claim whose truth matters.",
    inputSchema: {
      type: "object",
      properties: {
        claim: {
          type: "string",
          description:
            "A factual claim about something that either happened or did not, ideally recently. 20 to 2000 characters.",
        },
      },
      required: ["claim"],
    },
  },
  {
    name: "get_miner_health",
    description:
      "Live health for miners in the Telegraph catalog: which are routable, which actually answer when paid, latency, and recent errors. Use this to choose a miner or to diagnose a failing one.",
    inputSchema: {
      type: "object",
      properties: {
        minerId: {
          type: "string",
          description: "Optional. Restrict to a single miner id, e.g. \"202\".",
        },
      },
    },
  },
  {
    name: "get_claim",
    description:
      "Fetch a previously verified claim by its id, including verdict, sources, and payment receipts.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Claim id, e.g. \"c_ab12cd34\"." },
      },
      required: ["id"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function textContent(payload: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json({
    name: "xyle",
    version: "1.0.0",
    description:
      "Verify factual claims against four independent Telegraph miners, with on-chain receipts.",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http",
    endpoint: "/api/mcp",
    tools: TOOLS.map((t) => t.name),
    limits: {
      perIpHourly: cfg.verifyPerIpHourly,
      dailyBudgetUsdc: cfg.verifyDailyCapUsdc,
    },
  });
}

export async function POST(req: Request) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id = null, method, params = {} } = body;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "xyle", version: "1.0.0" },
        instructions:
          "Use verify_claim before acting on any factual claim that carries consequences. It returns uncertain rather than guessing when the evidence does not support a verdict; treat uncertain as 'do not act'.",
      });

    // Notifications carry no id and expect no response body.
    case "notifications/initialized":
      return new Response(null, { status: 202 });

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "ping":
      return rpcResult(id, {});

    case "tools/call": {
      const name = params.name as string;
      const args = (params.arguments ?? {}) as Record<string, unknown>;

      try {
        if (name === "get_miner_health") {
          const catalog = await fetchCatalog();
          const health = await db.minerHealth(catalog);
          const minerId = args.minerId ? String(args.minerId) : undefined;
          const rows = minerId
            ? health.filter((h) => h.minerId === minerId)
            : health;
          return rpcResult(
            id,
            textContent({
              at: new Date().toISOString(),
              miners: rows.map((h) => ({
                minerId: h.minerId,
                name: h.name,
                state: h.state,
                liveUptime: Number(h.liveUptime.toFixed(2)),
                liveProbes: h.liveProbes,
                p50LatencyMs: h.p50LatencyMs,
                lastError: h.lastError,
              })),
            })
          );
        }

        if (name === "get_claim") {
          const claim = await db.getClaim(String(args.id ?? ""));
          if (!claim) {
            return rpcResult(id, textContent({ error: "Claim not found" }, true));
          }
          return rpcResult(id, textContent(claim));
        }

        if (name === "verify_claim") {
          const cfg = loadConfig();
          const claim = String(args.claim ?? "").trim();

          if (claim.length < 20 || claim.length > 2000) {
            return rpcResult(
              id,
              textContent(
                { error: "claim must be between 20 and 2000 characters" },
                true
              )
            );
          }

          // Same guards as the HTTP endpoint: this spends real money.
          const gate = takeToken(`mcp:${clientIp(req)}`, cfg.verifyPerIpHourly);
          if (!gate.allowed) {
            return rpcResult(
              id,
              textContent(
                {
                  error: "rate_limited",
                  detail: `Limited to ${cfg.verifyPerIpHourly} verifications per hour.`,
                  retryAfterSeconds: gate.retryAfterSec,
                },
                true
              )
            );
          }

          const spent = await db.spendSince(DAY_MS);
          if (spent >= cfg.verifyDailyCapUsdc) {
            return rpcResult(
              id,
              textContent(
                {
                  error: "daily_budget_reached",
                  detail: `The oracle has spent its ${cfg.verifyDailyCapUsdc} USDC daily budget.`,
                },
                true
              )
            );
          }

          const result = await verifyClaim(claim);
          const stored = await db.saveClaim({
            claim: result.claim,
            verdict: result.verdict,
            confidence: result.confidence,
            reasoning: result.reasoning,
            authenticity: result.authenticity,
            consensus: result.consensus,
            stages: result.stages,
            sources: result.sources,
            proofs: result.proofs,
            minerCalls: result.minerCalls,
            costUsdc: result.costUsdcEstimate,
          });

          const base = (
            process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
          ).replace(/\/$/, "");

          return rpcResult(
            id,
            textContent({
              verdict: result.verdict,
              confidence: result.confidence,
              reasoning: result.reasoning,
              judgesAgreed: result.consensus.agreed,
              looksSynthetic: result.authenticity.aiLikely,
              stagesCompleted: result.stages?.completed,
              stagesDegraded: result.stages?.degraded ?? [],
              sources: result.sources.map((s) => ({
                title: s.title,
                url: s.url,
                publishedAt: s.publishedAt,
              })),
              costUsdc: result.costUsdcEstimate,
              permalink: `${base}/c/${stored.id}`,
            })
          );
        }

        return rpcError(id, -32602, `Unknown tool: ${name}`);
      } catch (err) {
        return rpcResult(
          id,
          textContent(
            { error: err instanceof Error ? err.message : String(err) },
            true
          )
        );
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
