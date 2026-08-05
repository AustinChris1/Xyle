import { loadConfig } from "./config";
import { db } from "./db";
import { withCallContext } from "./telegraph/call-context";
import {
  TelegraphError,
  chatJsonObject,
  detectAiText,
  judgeWithFallback,
  reasonJson,
  reasonJsonConsensus,
  searchNews,
} from "./telegraph/clients";
import type {
  Market,
  OracleTick,
  OracleVerdict,
  PaymentProof,
  VerifyResult,
} from "./types";

const SYSTEM_PROMPT = `You are a settlement judge for Signal Arena on Telegraph.
You receive: (1) today's date, (2) a market or claim, (3) dated news results,
(4) an authenticity score.
Decide if the REAL-WORLD event has clearly occurred RECENTLY, based on
authentic evidence.

Recency is not optional. Each source carries a published date. A market asking
about the last 48 hours is NOT satisfied by an incident from months ago, no
matter how well reported. If the only supporting coverage predates the market's
window, answer "no", not "yes".

Return ONLY valid JSON:
{
  "verdict": "yes" | "no" | "uncertain",
  "confidence": number between 0 and 1,
  "reasoning": "one short paragraph"
}

Rules:
- YES only if authentic multi-source evidence from WITHIN the window supports it.
- Prefer NO or uncertain if news looks synthetic, single-source, vague, or stale.
- Cite the dates you relied on in your reasoning.
- confidence must reflect evidence quality, authenticity, and recency.`;

/**
 * Miner calls are written to the ledger inside the client the moment they
 * resolve, so nothing here needs to log them. This wrapper only tags them
 * with where they came from.
 */
function attributed<T>(
  context: string,
  marketId: string | undefined,
  fn: () => Promise<T>
) {
  return withCallContext({ context, marketId }, fn);
}

export async function runOracleTick(marketId: string): Promise<OracleTick> {
  const market = await db.getMarket(marketId);
  if (!market) throw new Error("MARKET_NOT_FOUND");
  if (market.status !== "open") throw new Error("MARKET_NOT_OPEN");

  const fusion = await fuseClaim({
    claim: market.title,
    description: market.description,
    eventClass: market.eventClass,
    searchQuery: market.searchQuery,
    confidenceThreshold: market.confidenceThreshold,
    context: `market:${market.id}`,
    marketId: market.id,
  });

  const shouldSettle =
    fusion.verdict === "yes" &&
    fusion.confidence >= market.confidenceThreshold &&
    fusion.consensus.agreed &&
    !fusion.authenticity.aiLikely;

  const tick = await db.addTick({
    marketId: market.id,
    at: fusion.at,
    verdict: fusion.verdict,
    confidence: fusion.confidence,
    reasoning: fusion.reasoning,
    sources: fusion.sources,
    authenticity: fusion.authenticity,
    consensus: fusion.consensus,
    stages: fusion.stages,
    proofs: fusion.proofs,
    settled: false,
  });

  await db.updateMarket(market.id, { lastOracleAt: fusion.at });

  if (shouldSettle) {
    await settleMarket(market, tick.id, "yes");
    await db.pushActivity({
      kind: "settled",
      title: `Settled YES: ${market.title}`,
      detail: `${(fusion.confidence * 100).toFixed(0)}% confidence`,
      href: `/markets/${market.id}`,
      marketId: market.id,
    });
  } else if (new Date(market.closesAt).getTime() < Date.now()) {
    await settleMarket(market, tick.id, "no");
    await db.pushActivity({
      kind: "settled",
      title: `Settled NO (expired): ${market.title}`,
      href: `/markets/${market.id}`,
      marketId: market.id,
    });
  } else {
    await db.pushActivity({
      kind: "oracle_tick",
      title: `Reading: ${market.title}`,
      detail: `${fusion.verdict} @ ${(fusion.confidence * 100).toFixed(0)}%`,
      href: `/markets/${market.id}`,
      marketId: market.id,
    });
  }

  const updated = (await db.listTicks(market.id)).find((t) => t.id === tick.id);
  const finalTick = updated ?? tick;
  // Awaited on purpose: a serverless function can freeze the moment it
  // returns, dropping any promise still in flight, so fire-and-forget here
  // means webhooks silently never arrive in production.
  await notifyAfterTick(market.id, finalTick);
  return finalTick;
}

/** Public infrastructure API: verify any claim without a market. */
export async function verifyClaim(claim: string): Promise<VerifyResult> {
  const cfg = loadConfig();
  return fuseClaim({
    claim: claim.slice(0, 2000),
    description: "Ad-hoc verification request",
    eventClass: "verify",
    searchQuery: claim.slice(0, 120),
    confidenceThreshold: cfg.defaultConfidence,
    context: "api:verify",
  });
}

async function fuseClaim(input: {
  claim: string;
  description: string;
  eventClass: string;
  searchQuery: string;
  confidenceThreshold: number;
  context: string;
  marketId?: string;
}): Promise<VerifyResult> {
  return attributed(input.context, input.marketId, async () => {
    const proofs: PaymentProof[] = [];
    const degraded: string[] = [];

    // Stage 1: evidence. Degrades to an empty source list.
    const news = await searchNews(input.searchQuery || input.claim);
    if (news.proof) proofs.push(news.proof);
    if (news.degraded) degraded.push("evidence");

    const leadBlob = news.articles
      .map((a) => `${a.title}. ${a.snippet}`)
      .join("\n")
      .slice(0, 2500);

    const authText =
      leadBlob.length >= 120
        ? leadBlob
        : `${input.claim}\n\n${leadBlob}\nContext: ${input.description}`;

    // Stage 2: authenticity. Degrades to the local heuristic.
    const auth = await detectAiText(authText);
    if (auth.proof) proofs.push(auth.proof);
    if (auth.degraded) degraded.push("authenticity");

    // Models have no idea what day it is, so the window has to be stated.
    const now = Date.now();
    const windowDays = loadConfig().newsWindowDays;
    const ageDays = (iso?: string) =>
      iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : null;

    const freshest = news.articles.reduce<number | null>((best, a) => {
      const age = ageDays(a.publishedAt);
      if (age === null) return best;
      return best === null || age < best ? age : best;
    }, null);

    const userPrompt = [
      `Today is ${new Date(now).toISOString().slice(0, 10)}.`,
      `Only evidence from the last ${windowDays} days counts as current.`,
      `Claim / market: ${input.claim}`,
      `Event class: ${input.eventClass}`,
      `Description: ${input.description}`,
      `Confidence threshold: ${input.confidenceThreshold}`,
      `Authenticity: synthetic=${auth.answer === 1} score=${auth.score}`,
      news.articles.length > 0
        ? "News (with publication dates):"
        : "News: no corroborating coverage was retrievable.",
      ...news.articles.map((a, i) => {
        const age = ageDays(a.publishedAt);
        const when = a.publishedAt
          ? `${a.publishedAt.slice(0, 10)}, ${age} days ago`
          : "undated";
        return `${i + 1}. [${when}] ${a.title}: ${a.snippet}`;
      }),
    ].join("\n");

    // Stages 3 and 4: two independent judges. A single judge failing must not
    // sink the reading, but it does make consensus impossible, so the result
    // can no longer settle YES.
    const [resA, resB] = await Promise.allSettled([
      judgeWithFallback("A", SYSTEM_PROMPT, userPrompt),
      judgeWithFallback("B", SYSTEM_PROMPT, userPrompt),
    ]);

    const judgeA = resA.status === "fulfilled" ? resA.value : null;
    const judgeB = resB.status === "fulfilled" ? resB.value : null;
    if (judgeA) proofs.push(judgeA.proof);
    else degraded.push("judge A");
    if (judgeB) proofs.push(judgeB.proof);
    else degraded.push("judge B");

    const agreed = Boolean(
      judgeA && judgeB && judgeA.verdict === judgeB.verdict
    );

    let verdict: OracleVerdict;
    let confidence: number;
    let reasoning: string;

    if (judgeA && judgeB) {
      verdict = agreed ? judgeA.verdict : "uncertain";
      confidence = agreed
        ? (judgeA.confidence + judgeB.confidence) / 2
        : Math.min(judgeA.confidence, judgeB.confidence) * 0.6;
      reasoning = agreed
        ? `Both judges agreed. ${judgeA.reasoning}`
        : `No consensus: judge A said ${judgeA.verdict} at ${(judgeA.confidence * 100).toFixed(0)}%, judge B said ${judgeB.verdict} at ${(judgeB.confidence * 100).toFixed(0)}%. ${judgeA.reasoning}`;
    } else if (judgeA || judgeB) {
      const only = (judgeA ?? judgeB)!;
      // One judge cannot establish consensus, so a YES is downgraded.
      verdict = only.verdict === "yes" ? "uncertain" : only.verdict;
      confidence = Math.min(only.confidence, 0.5);
      reasoning = `Only one judge was reachable, so this reading cannot settle. That judge said ${only.verdict} at ${(only.confidence * 100).toFixed(0)}%. ${only.reasoning}`;
    } else {
      verdict = "uncertain";
      confidence = 0;
      reasoning =
        "Neither judge was reachable, so no verdict could be formed. The market stays open.";
    }

    if (auth.answer === 1 && auth.score >= 0.7 && verdict === "yes") {
      verdict = "uncertain";
      confidence = Math.min(confidence, 0.45);
      reasoning = `Held back: supporting text scored synthetic (${auth.score.toFixed(2)}). ${reasoning}`;
    }

    if (news.articles.length === 0 && verdict === "yes") {
      verdict = "uncertain";
      confidence = Math.min(confidence, 0.4);
      reasoning = `Held back: no corroborating coverage was retrievable. ${reasoning}`;
    }

    // Belt and braces on top of the prompt: if every dated source predates the
    // window, the claim is about something old and must not settle YES.
    if (verdict === "yes" && freshest !== null && freshest > windowDays) {
      verdict = "uncertain";
      confidence = Math.min(confidence, 0.4);
      reasoning = `Held back: the most recent supporting source is ${freshest} days old, outside the ${windowDays} day window. ${reasoning}`;
    }

    const cfg = loadConfig();
    const paid = proofs.filter((p) => !p.mocked);

    return {
      claim: input.claim,
      at: new Date().toISOString(),
      verdict,
      confidence: Math.round(confidence * 1000) / 1000,
      reasoning,
      authenticity: {
        aiLikely: auth.answer === 1,
        score: auth.score,
        detail: auth.detail,
        degraded: auth.degraded,
      },
      consensus: {
        judgeA: judgeA?.verdict ?? "uncertain",
        judgeB: judgeB?.verdict ?? "uncertain",
        agreed,
      },
      stages: {
        total: 4,
        completed: proofs.length,
        degraded,
      },
      sources: news.articles,
      proofs,
      minerCalls: proofs.length,
      costUsdcEstimate:
        Math.round(paid.length * cfg.costUsdcPerCall * 10000) / 10000,
    };
  });
}

async function settleMarket(
  market: Market,
  tickId: string,
  side: "yes" | "no"
) {
  await db.patchTick(tickId, { settled: true });
  await db.updateMarket(market.id, {
    status: side === "yes" ? "settled_yes" : "settled_no",
    settledAt: new Date().toISOString(),
    settlementTickId: tickId,
  });
}

async function notifyAfterTick(marketId: string, tick: OracleTick) {
  const market = await db.getMarket(marketId);
  if (!market) return;
  const settled = market.status.startsWith("settled");
  const users = await db.listUsers();
  if (users.length === 0) return;
  const { notifyWatchers } = await import("./webhooks");
  await notifyWatchers({
    users,
    market,
    tick: { ...tick, settled: settled || tick.settled },
    onUserAlert: (address, alert) => db.pushUserAlert(address, alert),
  });
}

export async function runChallenge(
  player: string,
  text: string,
  address?: string
) {
  const { proofs, auth, judgeA, judgeB } = await attributed(
    "challenge",
    undefined,
    async () => {
      const proofs: PaymentProof[] = [];

      const auth = await detectAiText(text);
      if (auth.proof) proofs.push(auth.proof);

      const q = text.split(/\s+/).slice(0, 8).join(" ");
      const news = await searchNews(q || "crypto news");
      if (news.proof) proofs.push(news.proof);

      const [resA, resB] = await Promise.allSettled([
        reasonJson(
          `You evaluate whether a SUBMITTED CLAIM would trick a settlement oracle into saying YES (event occurred).
Return ONLY JSON: {"verdict":"yes"|"no"|"uncertain","confidence":0-1,"reasoning":"..."}
- verdict yes = you would settle the event as occurred based on this text alone
- Prefer no if clearly fake or AI-slop`,
          `Submitted claim:\n${text}\n\nAuthenticity: synthetic=${auth.answer === 1} score=${auth.score}\nNews: ${news.articles.map((a) => a.title).join(" | ")}`
        ),
        reasonJsonConsensus(
          `Second independent judge: would this claim falsely settle YES?
Return ONLY JSON: {"verdict":"yes"|"no"|"uncertain","confidence":0-1,"reasoning":"..."}`,
          text.slice(0, 3000)
        ),
      ]);

      const judgeA = resA.status === "fulfilled" ? resA.value : null;
      const judgeB = resB.status === "fulfilled" ? resB.value : null;
      if (judgeA) proofs.push(judgeA.proof);
      if (judgeB) proofs.push(judgeB.proof);

      return { proofs, auth, judgeA, judgeB };
    }
  );

  if (!judgeA && !judgeB) {
    throw new TelegraphError(
      "No judge miner was reachable, so this attempt could not be scored. Try again shortly.",
      "NO_JUDGE_AVAILABLE",
      503
    );
  }

  const judges = [judgeA, judgeB].filter((j) => j !== null);
  const conf = judges.reduce((a, j) => a + j.confidence, 0) / judges.length;
  const yesVotes = judges.filter((j) => j.verdict === "yes").length;
  const noVotes = judges.filter((j) => j.verdict === "no").length;

  const verdict: OracleVerdict =
    yesVotes === judges.length
      ? "yes"
      : noVotes === judges.length
        ? "no"
        : "uncertain";

  const aiPenalty = auth.answer === 1 ? 0.15 : 0;
  let foolScore =
    conf * (verdict === "yes" ? 1 : verdict === "uncertain" ? 0.55 : 0.25);
  if (auth.answer === 1) foolScore = Math.min(1, foolScore + conf * 0.15);
  foolScore = Math.max(0, Math.min(1, foolScore - aiPenalty * 0.1));
  // A single-judge run cannot claim a break, so cap it.
  if (judges.length < 2) foolScore = Math.min(foolScore, 0.6);
  foolScore = Math.round(foolScore * 1000) / 1000;

  // Breaking the oracle requires beating both judges, not one.
  const brokeThreshold =
    judges.length === 2 && verdict === "yes" && conf >= 0.72;

  const scoreLine = judges.length === 2
    ? `A: ${judgeA!.verdict} at ${(judgeA!.confidence * 100).toFixed(0)}%, B: ${judgeB!.verdict} at ${(judgeB!.confidence * 100).toFixed(0)}%.`
    : `Only one judge was reachable, so this attempt cannot count as a break.`;

  const attempt = await db.addChallenge({
    player: player.trim().slice(0, 32) || "anon",
    address,
    text: text.slice(0, 4000),
    createdAt: new Date().toISOString(),
    foolScore,
    confidence: conf,
    aiDetected: auth.answer === 1,
    verdict,
    reasoning: `${scoreLine} ${judges[0].reasoning}`,
    proofs,
    brokeThreshold,
  });

  await db.pushActivity({
    kind: brokeThreshold ? "break" : "challenge",
    title: brokeThreshold
      ? `Oracle break by ${attempt.player}`
      : `Adversary attempt by ${attempt.player}`,
    detail: `score ${(foolScore * 100).toFixed(1)} · ${verdict}`,
    href: "/challenge",
  });

  return attempt;
}

/** Auto-open markets from live news + LLM framing. */
export async function generateMarketsFromNews(max = 2): Promise<Market[]> {
  const cfg = loadConfig();
  const news = await attributed("auto:market-scan", undefined, () =>
    searchNews(
      "crypto DeFi exploit hack OR major flight cancellation airport OR viral crypto claim denied"
    )
  );

  if (news.articles.length === 0) return [];

  const existing = await db.listMarkets();
  const existingTitles = new Set(existing.map((m) => m.title.toLowerCase()));

  const framing = await attributed("auto:market-frame", undefined, () =>
    chatJsonObject(
      `You create short prediction-market questions from news.
Return ONLY JSON: {"markets":[{"title":"...?","description":"...","eventClass":"defi_exploit|flight_disruption|claim_contradiction|other","searchQuery":"..."}]}
Max ${max} markets. Titles must be yes/no questions. Skip duplicates of: ${[...existingTitles].slice(0, 10).join(" | ")}`,
      news.articles
        .slice(0, 5)
        .map((a) => `${a.title}: ${a.snippet}`)
        .join("\n")
    )
  );

  let proposed: Array<{
    title: string;
    description: string;
    eventClass: string;
    searchQuery: string;
  }> = [];

  const marketsRaw = framing.data.markets;
  if (Array.isArray(marketsRaw)) {
    proposed = marketsRaw
      .filter(
        (x): x is Record<string, string> =>
          !!x && typeof x === "object" && typeof (x as { title?: string }).title === "string"
      )
      .filter((x) => (x.title as string).length > 12)
      .map((x) => ({
        title: x.title as string,
        description:
          (x.description as string) ||
          "Auto-opened from live news. Settles on multi-miner consensus.",
        eventClass: (x.eventClass as string) || "other",
        searchQuery: (x.searchQuery as string) || (x.title as string),
      }));
  }

  // Fallback: one market from top headline
  if (proposed.length === 0 && news.articles[0]) {
    const h = news.articles[0];
    proposed = [
      {
        title: `Is this report material: ${h.title.slice(0, 100)}?`,
        description: `Auto-opened from live coverage. ${h.snippet.slice(0, 200)}`,
        eventClass: "other",
        searchQuery: h.title.slice(0, 80),
      },
    ];
  }

  const created: Market[] = [];
  for (const p of proposed.slice(0, max)) {
    if (existingTitles.has(p.title.toLowerCase())) continue;
    const market = await db.createMarket({
      ...p,
      confidenceThreshold: cfg.defaultConfidence,
      closesInHours: 48,
      source: "auto",
      sourceHeadline: news.articles[0]?.title,
    });
    created.push(market);
    existingTitles.add(p.title.toLowerCase());
  }
  return created;
}

/**
 * Ticks open markets oldest-read first, capped per cycle.
 *
 * A reading takes roughly 15s and costs ~0.04 USDC. Ticking every open market
 * in one invocation blows past the 60s serverless ceiling once there are more
 * than three, and at a 15 minute cadence the spend compounds fast. Capping and
 * rotating means every market still gets read regularly, just not all at once.
 */
export async function runAllOpenOracles(limit: number) {
  const markets = await db.listMarkets();
  const open = markets
    .filter((m) => m.status === "open")
    .sort((a, b) => {
      // Never-read markets first, then least recently read.
      const at = a.lastOracleAt ? new Date(a.lastOracleAt).getTime() : 0;
      const bt = b.lastOracleAt ? new Date(b.lastOracleAt).getTime() : 0;
      return at - bt;
    });

  const due = open.slice(0, Math.max(0, limit));
  const results: Array<{ marketId: string; ok: boolean; error?: string }> = [];

  for (const market of due) {
    try {
      await runOracleTick(market.id);
      results.push({ marketId: market.id, ok: true });
    } catch (err) {
      results.push({
        marketId: market.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, openTotal: open.length, skipped: open.length - due.length };
}

/** Cron: tick oracles + optionally open markets from news. */
export async function runCronCycle() {
  const cfg = loadConfig();

  // Hard stop before spending anything if the rolling budget is used up.
  const spentToday = await db.spendSince(24 * 60 * 60 * 1000);
  if (spentToday >= cfg.cronDailyCapUsdc) {
    await db.setLastCronAt(new Date().toISOString());
    return {
      skippedReason: "daily budget reached",
      spentUsdcLast24h: spentToday,
      capUsdc: cfg.cronDailyCapUsdc,
      autoMarkets: [],
      oracle: { results: [], openTotal: 0, skipped: 0 },
    };
  }

  // Opening a market every cycle while only reading a couple of them means
  // the board grows faster than it can be judged, and every market ends up
  // stale. Stop creating once the backlog is more than the reader can clear.
  const openNow = (await db.openMarketIds()).length;
  const backlogFull = openNow >= cfg.cronMaxOpenMarkets;

  const autoMarkets =
    cfg.cronAutoMarkets && !backlogFull
      ? await generateMarketsFromNews(cfg.cronAutoMarketsPerCycle).catch(
          (err) => {
            console.warn("[cron] auto markets failed:", err);
            return [] as Market[];
          }
        )
      : [];

  const oracle = await runAllOpenOracles(cfg.cronMarketsPerCycle);
  await db.setLastCronAt(new Date().toISOString());

  return {
    autoMarkets: autoMarkets.map((m) => m.id),
    autoMarketsPaused: backlogFull,
    oracle,
    spentUsdcLast24h: await db.spendSince(24 * 60 * 60 * 1000),
    capUsdc: cfg.cronDailyCapUsdc,
  };
}
