import type { Agent, Market, OracleTick, UserProfile } from "./types";
import { signPayload, validateCallbackUrl } from "./webhook-safety";

export interface SettleWebhookPayload {
  type: "market.settled" | "market.reading" | "webhook.test";
  at: string;
  market: {
    id: string;
    title: string;
    status: string;
    confidence?: number;
    verdict?: string;
  };
  tick?: {
    id: string;
    verdict: string;
    confidence: number;
    settled: boolean;
  };
  agentId?: string;
}

/**
 * Discord and Slack reject arbitrary JSON: they want their own body shape.
 * Detecting them means a user can paste the URL their community already uses
 * instead of standing up a receiver, which is the difference between a
 * developer feature and something a Discord admin will actually set up.
 */
function chatFlavour(url: string): "discord" | "slack" | null {
  if (/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//i.test(url)) {
    return "discord";
  }
  if (/^https:\/\/hooks\.slack\.com\//i.test(url)) return "slack";
  return null;
}

const VERDICT_COLOR: Record<string, number> = {
  yes: 0x3ddc97,
  no: 0xff5f6d,
  uncertain: 0xffc93c,
};

function toDiscordBody(payload: SettleWebhookPayload, appUrl: string) {
  const verdict = payload.market.verdict ?? "uncertain";
  const conf = payload.market.confidence
    ? `${(payload.market.confidence * 100).toFixed(0)}%`
    : "n/a";
  const isTest = payload.type === "webhook.test";

  return {
    username: "Xyle",
    embeds: [
      {
        title: isTest ? "Test event from Xyle" : payload.market.title,
        url: payload.market.id.startsWith("mkt_")
          ? `${appUrl}/markets/${payload.market.id}`
          : undefined,
        description: isTest
          ? "Your endpoint is wired up correctly. Real settlements look like this."
          : `Settled **${verdict.toUpperCase()}** at ${conf} confidence.`,
        color: VERDICT_COLOR[verdict] ?? VERDICT_COLOR.uncertain,
        fields: [
          { name: "Verdict", value: verdict, inline: true },
          { name: "Confidence", value: conf, inline: true },
        ],
        footer: { text: "Verified answers, with receipts" },
        timestamp: payload.at,
      },
    ],
  };
}

function toSlackBody(payload: SettleWebhookPayload, appUrl: string) {
  const verdict = payload.market.verdict ?? "uncertain";
  const conf = payload.market.confidence
    ? `${(payload.market.confidence * 100).toFixed(0)}%`
    : "n/a";
  const link = payload.market.id.startsWith("mkt_")
    ? ` <${appUrl}/markets/${payload.market.id}|View>`
    : "";
  return {
    text:
      payload.type === "webhook.test"
        ? "Test event from Xyle. Your endpoint works."
        : `*${payload.market.title}* settled *${verdict.toUpperCase()}* at ${conf}.${link}`,
  };
}

export async function deliverWebhook(
  url: string,
  payload: SettleWebhookPayload,
  timeoutMs = 8000
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const safe = validateCallbackUrl(url);
  if (!safe.ok) return { ok: false, error: safe.reason };

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://usexyle.vercel.app").replace(
    /\/$/,
    ""
  );
  const flavour = chatFlavour(safe.url);
  const body = JSON.stringify(
    flavour === "discord"
      ? toDiscordBody(payload, appUrl)
      : flavour === "slack"
        ? toSlackBody(payload, appUrl)
        : payload
  );
  // Chat platforms verify nothing, and the signature only makes sense over
  // our own envelope, so it is attached to raw JSON deliveries only.
  const signature = flavour ? undefined : signPayload(body);

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(safe.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Xyle-Webhook/1.0",
        ...(signature ? { "X-Xyle-Signature": signature } : {}),
      },
      body,
      signal: controller.signal,
      redirect: "error",
    });
    clearTimeout(t);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Sample event so a receiver can be verified without waiting for a settle. */
export function buildTestPayload(agentId?: string): SettleWebhookPayload {
  return {
    type: "webhook.test",
    at: new Date().toISOString(),
    market: {
      id: "mkt_test",
      title: "Test event from Xyle",
      status: "settled_yes",
      verdict: "yes",
      confidence: 0.91,
    },
    tick: {
      id: "tick_test",
      verdict: "yes",
      confidence: 0.91,
      settled: true,
    },
    ...(agentId ? { agentId } : {}),
  };
}

export function buildSettlePayload(
  market: Market,
  tick: OracleTick
): SettleWebhookPayload {
  return {
    type: tick.settled ? "market.settled" : "market.reading",
    at: new Date().toISOString(),
    market: {
      id: market.id,
      title: market.title,
      status: market.status,
      confidence: tick.confidence,
      verdict: tick.verdict,
    },
    tick: {
      id: tick.id,
      verdict: tick.verdict,
      confidence: tick.confidence,
      settled: tick.settled,
    },
  };
}

export async function notifyWatchers(input: {
  users: UserProfile[];
  market: Market;
  tick: OracleTick;
  onUserAlert: (
    address: string,
    alert: {
      kind: "settled" | "confidence" | "agent_delivery";
      title: string;
      detail?: string;
      href?: string;
      marketId?: string;
    }
  ) => Promise<void>;
}) {
  const { users, market, tick, onUserAlert } = input;
  const payload = buildSettlePayload(market, tick);
  const titleLower = market.title.toLowerCase();
  const deliveries: Promise<void>[] = [];

  for (const user of users) {
    const watchingMarket = user.watchlistMarketIds.includes(market.id);
    const watchingKeyword = user.watchlistKeywords.some((k) =>
      titleLower.includes(k.toLowerCase())
    );
    const interested = watchingMarket || watchingKeyword;

    if (interested && tick.settled) {
      await onUserAlert(user.address, {
        kind: "settled",
        title: `Settled ${tick.verdict.toUpperCase()}: ${market.title}`,
        detail: `${(tick.confidence * 100).toFixed(0)}% confidence`,
        href: `/markets/${market.id}`,
        marketId: market.id,
      });
      if (user.webhookUrl) {
        deliveries.push(deliverWebhook(user.webhookUrl, payload).then(() => {}));
      }
    }

    if (
      interested &&
      !tick.settled &&
      tick.confidence >= market.confidenceThreshold
    ) {
      await onUserAlert(user.address, {
        kind: "confidence",
        title: `Near bar: ${market.title}`,
        detail: `${tick.verdict} @ ${(tick.confidence * 100).toFixed(0)}%`,
        href: `/markets/${market.id}`,
        marketId: market.id,
      });
    }

    // Agents fire on settlement of a market this user actually watches,
    // which is what the desk copy promises. Deliveries are awaited: a
    // fire-and-forget promise is dropped when a serverless function freezes
    // after returning its response.
    if (interested && tick.settled) {
      deliveries.push(
        ...user.agents.map(async (agent) => {
          const r = await deliverWebhook(agent.callbackUrl, {
            ...payload,
            agentId: agent.id,
          });
          await onUserAlert(user.address, {
            kind: "agent_delivery",
            title: r.ok
              ? `Agent "${agent.name}" notified`
              : `Agent "${agent.name}" delivery failed`,
            detail: r.ok
              ? `HTTP ${r.status ?? 200}`
              : r.error || `HTTP ${r.status ?? "no response"}`,
            href: `/desk`,
            marketId: market.id,
          });
        })
      );
    }
  }

  // One slow receiver must not sink the rest.
  await Promise.allSettled(deliveries);
}

export type { Agent };
