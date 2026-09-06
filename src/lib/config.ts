/**
 * Live Telegraph node:
 *   NODE  :7044  /miner-dispatcher/v1/{id}{path}
 * Payment: eip155:84532 (Base Sepolia) USDC, ~0.01 per call
 *
 * Multi-miner map (distinct integrations):
 *   news          202 Tavily
 *   authenticity  115 Bedrock DeepSeek  (109 Gemini is quota-dead)
 *   reason A      110 OpenRouter
 *   reason B      104 LiteLLM Nova (consensus)
 */
export function loadConfig() {
  const forceMock = process.env.FORCE_MOCK === "true";
  const evmKey =
    process.env.EVM_PRIVATE_KEY?.trim() ||
    process.env.TELEGRAPH_EVM_PRIVATE_KEY?.trim() ||
    "";
  const solKey =
    process.env.SOLANA_PRIVATE_KEY?.trim() ||
    process.env.TELEGRAPH_SOLANA_PRIVATE_KEY?.trim() ||
    "";

  return {
    telegraphBaseUrl: (
      process.env.TELEGRAPH_NODE_URL ||
      process.env.TELEGRAPH_BASE_URL ||
      "http://13.237.89.59:7044"
    ).replace(/\/$/, ""),
    minerDispatcherPrefix:
      process.env.MINER_DISPATCHER_PREFIX || "/miner-dispatcher/v1",

    /**
     * Evidence must be recent or a market asking about "the next 48 hours"
     * will happily settle on a nine-month-old article. Tavily accepts `days`
     * even though the node's catalog schema does not advertise it (probed
     * 2026-08-05: without it, results reached back to Nov 2025).
     */
    newsWindowDays: Number(process.env.NEWS_WINDOW_DAYS ?? 7) || 7,

    newsMinerId: process.env.NEWS_MINER_ID || "202",
    newsPath: process.env.NEWS_PATH || "/search",
    newsLabel: process.env.NEWS_LABEL || "Tavily",
    newsMinerAltId: process.env.NEWS_ALT_MINER_ID || "210",
    newsAltLabel: process.env.NEWS_ALT_LABEL || "GNews",

    // Distinct from both judgment miners.
    // Miner 109 (Gemini) was probed on 2026-08-04 and returns upstream 429
    // "exceeded your current quota" on every documented model, so authenticity
    // runs on 115 (Bedrock DeepSeek), which passed the same probe.
    authMinerId: process.env.AUTH_MINER_ID || "115",
    authPath: process.env.AUTH_PATH || "/chat",
    authModel: process.env.AUTH_MODEL || "deepseek",
    authLabel: process.env.AUTH_LABEL || "DeepSeek",

    reasonMinerId: process.env.REASON_MINER_ID || "110",
    reasonPath: process.env.REASON_PATH || "/chat",
    reasonModel: process.env.REASON_MODEL || "openai/gpt-4o-mini",
    reasonLabel: process.env.REASON_LABEL || "OpenRouter",

    consensusMinerId: process.env.CONSENSUS_MINER_ID || "104",
    consensusPath: process.env.CONSENSUS_PATH || "/chat",
    consensusModel: process.env.CONSENSUS_MODEL || "nova-2-lite",
    consensusLabel: process.env.CONSENSUS_LABEL || "LiteLLM Nova",

    /**
     * Judge fallbacks. Measured from the ledger, the two judge miners run at
     * 82% and 88% success on free tiers, so both landing is only ~72% of
     * readings, and a reading missing a judge can never settle even though it
     * was paid for. A distinct backup per seat recovers most of that.
     * Failed calls are not settled, so a retry costs one call, not two.
     */
    reasonFallbackMinerId: process.env.REASON_FALLBACK_MINER_ID || "117",
    reasonFallbackModel: process.env.REASON_FALLBACK_MODEL || "qwen",
    reasonFallbackLabel: process.env.REASON_FALLBACK_LABEL || "Bedrock Qwen",

    consensusFallbackMinerId:
      process.env.CONSENSUS_FALLBACK_MINER_ID || "114",
    consensusFallbackModel:
      process.env.CONSENSUS_FALLBACK_MODEL || "nova-2-lite",
    consensusFallbackLabel:
      process.env.CONSENSUS_FALLBACK_LABEL || "Bedrock Nova",

    /**
     * Cron guards. A reading is ~15s and ~0.04 USDC, so ticking every open
     * market in one invocation exceeds the 60s serverless ceiling past about
     * three markets, and an unbounded 15 minute cadence drains the wallet in
     * hours. Markets rotate oldest-read first, so all still get covered.
     */
    cronMarketsPerCycle: Number(process.env.CRON_MARKETS_PER_CYCLE ?? 2) || 2,
    cronAutoMarkets: process.env.CRON_AUTO_MARKETS !== "false",
    cronAutoMarketsPerCycle:
      Number(process.env.CRON_AUTO_MARKETS_PER_CYCLE ?? 1) || 1,
    cronDailyCapUsdc: Number(process.env.CRON_DAILY_CAP_USDC ?? 5) || 5,
    /**
     * Stop opening new markets once the board is larger than the reader can
     * work through. Otherwise auto-markets accumulate faster than readings
     * clear them and every market goes stale.
     */
    cronMaxOpenMarkets: Number(process.env.CRON_MAX_OPEN_MARKETS ?? 12) || 12,

    /**
     * Pulse deep probes per cycle. Free routability runs over the whole
     * catalog; only this many miners get a paid liveness check, rotating, so
     * a faucet wallet is not drained proving what a 402 already implies.
     */
    pulseDeepPerCycle: Number(process.env.PULSE_DEEP_PER_CYCLE ?? 2) || 2,
    /**
     * Routability probes per cycle. Was an unbounded sweep of the whole
     * catalog; capped after the Telegraph team asked participants to stop
     * automating high-volume calls against the shared node.
     */
    pulseRoutablePerCycle:
      Number(process.env.PULSE_ROUTABLE_PER_CYCLE ?? 12) || 12,

    /** Spend ceiling for the public verify endpoint, per rolling 24h. */
    verifyDailyCapUsdc:
      Number(process.env.VERIFY_DAILY_CAP_USDC ?? 2) || 2,
    /** Verify requests allowed per IP per hour. */
    verifyPerIpHourly: Number(process.env.VERIFY_PER_IP_HOURLY ?? 6) || 6,

    // ~0.01 USDC from live 402 amount "10000" (6 decimals)
    costUsdcPerCall: Number(process.env.COST_USDC_PER_CALL ?? 0.01) || 0.01,

    timeoutMs: Number(process.env.ORACLE_TIMEOUT_MS ?? 45000) || 45000,
    defaultConfidence:
      Number(process.env.DEFAULT_CONFIDENCE_THRESHOLD ?? 0.72) || 0.72,
    /** Cron interval minutes (UI countdown + vercel.json should match). */
    oracleIntervalMinutes:
      Number(process.env.ORACLE_INTERVAL_MINUTES ?? 15) || 15,
    mockMode: forceMock,
    hasEvmKey: Boolean(evmKey),
    hasSolKey: Boolean(solKey),
    hasPaymentKey: Boolean(evmKey || solKey),
    evmPrivateKey: evmKey,
    solanaPrivateKey: solKey,
    evmNetwork: (process.env.EVM_NETWORK ||
      "eip155:84532") as `${string}:${string}`,
    svmNetwork: (process.env.SVM_NETWORK || "solana:*") as `${string}:${string}`,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    tursoUrl: process.env.TURSO_DATABASE_URL?.trim() || "",
    tursoToken: process.env.TURSO_AUTH_TOKEN?.trim() || "",
    cronSecret: process.env.CRON_SECRET?.trim() || "",
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
