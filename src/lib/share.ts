import type { ChallengeAttempt, Market, OracleTick } from "./types";

export function shareMarketSettled(input: {
  handle: string;
  market: Market;
  tick: OracleTick;
  appUrl: string;
}) {
  const { handle, market, tick, appUrl } = input;
  const txs = tick.proofs
    .map((p) => p.txHash)
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => `${t!.slice(0, 10)}…`)
    .join(" ");
  return [
    `@${handle} · market settled ${tick.verdict.toUpperCase()} @ ${(tick.confidence * 100).toFixed(0)}%`,
    market.title,
    `4-miner oracle · receipts ${txs || "on ledger"}`,
    `${appUrl}/markets/${market.id}`,
    `@Telegraphprotoc #SignalArena`,
  ].join("\n");
}

export function shareBreak(input: {
  handle: string;
  attempt: ChallengeAttempt;
  appUrl: string;
}) {
  const { handle, attempt, appUrl } = input;
  return [
    `@${handle} scored ${(attempt.foolScore * 100).toFixed(1)} fooling Signal Arena`,
    `Verdict ${attempt.verdict} · dual-judge pipeline`,
    attempt.brokeThreshold ? "CLEARED THE BAR" : "desk held",
    `${appUrl}/challenge`,
    `@Telegraphprotoc #SignalArena`,
  ].join("\n");
}

export function openShare(text: string) {
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
