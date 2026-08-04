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
