"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Market, OracleTick, Stake } from "@/lib/types";
import { ease, fadeUp, listItem, scaleIn, stagger } from "@/lib/motion";
import { StatusPill } from "./StatusPill";
import { ActionButton } from "@/components/ActionButton";
import { useToast } from "@/components/Toast";
import { BoltIcon } from "@/components/Icon";
import { ProofTrace } from "./ProofTrace";
import { CountUp } from "./CountUp";
import { NextReading } from "./NextReading";
import { WatchButton } from "./WatchButton";
import { useAuth } from "@/hooks/useAuth";
import { openShare, shareMarketSettled } from "@/lib/share";

/**
 * Explains what this reading did to the market.
 *
 * Only a YES can resolve a market early; a NO means "not yet" and leaves it
 * open until the close date. Saying so plainly avoids the reasonable
 * assumption that a high-confidence NO above the bar should have settled.
 */
function settlementNote(tick: OracleTick, market: Market): string {
  const bar = (market.confidenceThreshold * 100).toFixed(0);
  const closes = new Date(market.closesAt).toLocaleDateString();

  if (tick.settled) return "This reading resolved the market.";

  if (tick.verdict === "yes") {
    if (!tick.consensus?.agreed) {
      return "Judges disagreed, so this cannot resolve the market. Both must agree on YES.";
    }
    if (tick.confidence < market.confidenceThreshold) {
      return `A YES needs ${bar}% confidence to resolve this market. This reading fell short.`;
    }
    return "Held back by the authenticity or freshness check.";
  }

  return `Not yet. Only a YES above ${bar}% resolves a market early, so a NO simply leaves it open. If it is still unconfirmed on ${closes}, it settles NO automatically.`;
}

/** Stale evidence is the main way a verdict goes wrong, so surface the age. */
function relativeAge(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const VERDICT_TONE: Record<string, string> = {
  yes: "text-yes",
  no: "text-no",
  uncertain: "text-warn",
};

export function MarketDetailClient({
  initialMarket,
  initialStakes,
  initialTicks,
  network,
  lastCronAt,
  intervalMinutes = 15,
}: {
  initialMarket: Market;
  initialStakes: Stake[];
  initialTicks: OracleTick[];
  network: string;
  lastCronAt?: string | null;
  intervalMinutes?: number;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [market, setMarket] = useState(initialMarket);
  const [stakes, setStakes] = useState(initialStakes);
  const [ticks, setTicks] = useState(initialTicks);
  const [busy, setBusy] = useState<"stake" | "oracle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // The signed-in wallet's existing call, so the buttons show current state.
  const [myForecast, setMyForecast] = useState<"yes" | "no" | null>(
    () =>
      initialStakes.find(
        (f) => f.address && user?.address &&
          f.address.toLowerCase() === user.address.toLowerCase()
      )?.side ?? null
  );

  const pushLog = useCallback((line: string) => {
    setLog((prev) =>
      [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 40)
    );
  }, []);

  const placeForecast = useCallback(
    async (choice: "yes" | "no") => {
      if (!user) {
        toast.warn("Connect a wallet and sign in to record a forecast.");
        return;
      }
      setBusy("stake");
      setError(null);
      try {
        const res = await fetch(`/api/markets/${market.id}/forecast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ side: choice }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.detail ?? data.error ?? "Could not record that forecast"
          );

        setMarket(data.market);
        setStakes((prev) => {
          const others = prev.filter(
            (f) => f.address?.toLowerCase() !== user.address.toLowerCase()
          );
          return [...others, data.forecast];
        });
        setMyForecast(choice);
        pushLog(`forecast ${choice.toUpperCase()} by ${user.handle}`);
        toast.success(`Your call: ${choice.toUpperCase()}`);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not record that forecast";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(null);
      }
    },
    [market.id, user, pushLog, toast]
  );

  const runOracle = useCallback(async () => {
    setBusy("oracle");
    setError(null);
    pushLog("reading: news + authenticity + dual judges");
    try {
      const res = await fetch(`/api/markets/${market.id}/oracle`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? data.error ?? "The reading failed");
      setTicks((t) => [data.tick, ...t]);
      setMarket(data.market);
      const tick = data.tick as OracleTick;
      pushLog(
        `verdict ${tick.verdict.toUpperCase()} at ${(tick.confidence * 100).toFixed(1)}%${
          tick.settled ? ", market settled" : ""
        }`
      );
      for (const p of tick.proofs) {
        pushLog(
          `  ${String(p.label || p.role || p.subnet).slice(0, 30)} ${
            p.mocked ? "simulated" : "paid"
          } ${p.latencyMs}ms${p.txHash ? ` ${p.txHash.slice(0, 12)}` : ""}`
        );
      }

      const degraded = tick.stages?.degraded ?? [];
      if (tick.settled) {
        toast.success(
          `Settled ${tick.verdict.toUpperCase()} at ${(tick.confidence * 100).toFixed(0)}% confidence`
        );
      } else if (degraded.length > 0) {
        toast.warn(
          `Reading done on ${tick.stages?.completed} of ${tick.stages?.total} stages. Unavailable: ${degraded.join(", ")}.`
        );
      } else {
        toast.info(
          `Reading done: ${tick.verdict} at ${(tick.confidence * 100).toFixed(0)}%. Market stays open.`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The reading failed";
      setError(msg);
      pushLog(`error: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, [market.id, pushLog, toast]);

  const total = market.potYes + market.potNo;
  const latest = ticks[0];
  const yesPct = total > 0 ? (market.potYes / total) * 100 : 50;
  const settled = market.status !== "open";

  return (
    <motion.div
      variants={stagger(0.05, 0.09)}
      initial="hidden"
      animate="show"
      className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
    >
      <div className="space-y-5">
        <motion.section variants={fadeUp} className="panel rounded-xl p-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <StatusPill status={market.status} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {market.eventClass.replace(/_/g, " ")}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <WatchButton marketId={market.id} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {settled ? "Closed" : "Closes"}{" "}
                {new Date(market.closesAt).toLocaleDateString()}
              </span>
            </span>
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {market.title}
          </h1>
          <p className="mt-3 leading-relaxed text-muted">{market.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "Say YES", v: market.potYes, d: 0, c: "text-yes" },
              { k: "Say NO", v: market.potNo, d: 0, c: "text-no" },
              {
                k: "Confidence bar",
                v: market.confidenceThreshold * 100,
                d: 0,
                c: "text-copper-hot",
                suffix: "%",
              },
              { k: "Forecasters", v: total, d: 0, c: "text-ink" },
            ].map((cell) => (
              <div key={cell.k} className="sunken rounded-lg p-3">
                <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
                  {cell.k}
                </div>
                <div className={`mt-1 font-mono text-lg ${cell.c}`}>
                  <CountUp value={cell.v} decimals={cell.d} />
                  {cell.suffix ?? ""}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="meter">
              <motion.div
                className="h-full bg-yes"
                animate={{ width: `${yesPct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wide text-faint">
              <span>{yesPct.toFixed(0)}% say yes</span>
              <span>{(100 - yesPct).toFixed(0)}% say no</span>
            </div>
          </div>
        </motion.section>

        {market.status === "open" ? (
          <motion.section variants={fadeUp} className="panel-hot rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="eyebrow">Your forecast</h2>
              <NextReading
                lastOracleAt={market.lastOracleAt || latest?.at}
                lastCronAt={lastCronAt}
                intervalMinutes={intervalMinutes}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {user
                ? "One call per wallet. You can change it while the market is open, and your accuracy is what scores on the leaderboard."
                : "Connect a wallet to record your call. One per wallet, and you can change it while the market is open."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["yes", "no"] as const).map((option) => {
                const picked = myForecast === option;
                const tone =
                  option === "yes"
                    ? "border-yes/50 bg-yes/15 text-yes"
                    : "border-no/50 bg-no/15 text-no";
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={busy !== null || !user}
                    aria-pressed={picked}
                    onClick={() => void placeForecast(option)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-4 transition-colors disabled:opacity-50 ${
                      picked
                        ? tone
                        : "border-line text-muted hover:border-copper/40 hover:text-ink"
                    }`}
                  >
                    <span className="font-mono text-lg font-semibold">
                      {option.toUpperCase()}
                    </span>
                    <span className="text-[11px]">
                      {option === "yes"
                        ? "It will happen"
                        : "It will not happen"}
                    </span>
                  </button>
                );
              })}
            </div>

            {myForecast && (
              <p className="mt-3 font-mono text-[11px] text-copper">
                Your call: {myForecast.toUpperCase()}. Tap the other option to
                change it.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionButton
                variant="ghost"
                pending={busy === "oracle"}
                pendingLabel="Reading the evidence"
                disabled={busy !== null}
                onClick={runOracle}
                className="w-full text-sm font-semibold text-copper-hot sm:w-auto"
              >
                <BoltIcon size={14} />
                Run the oracle
              </ActionButton>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-sm text-no"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.section>
        ) : (
          <motion.section variants={fadeUp} className="panel rounded-xl p-6">
            <h2 className="eyebrow">Settled</h2>
            <p className="mt-2 text-sm text-muted">
              This market is closed. The reading below is the one that resolved
              it.
            </p>
          </motion.section>
        )}

        <AnimatePresence mode="wait">
          {latest && (
            <motion.section
              key={latest.id}
              variants={scaleIn}
              initial="hidden"
              animate="show"
              exit="exit"
              className="panel rounded-xl p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="eyebrow">Latest reading</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                  {new Date(latest.at).toLocaleString()}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <span
                  className={`font-mono text-3xl font-semibold uppercase ${
                    VERDICT_TONE[latest.verdict] ?? "text-ink"
                  }`}
                >
                  {latest.verdict}
                </span>
                <span className="font-mono text-lg text-muted tabular">
                  {(latest.confidence * 100).toFixed(1)}% confident
                </span>
                {latest.settled && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, ease }}
                    className="rounded-full border border-copper/50 bg-copper/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-copper-hot"
                  >
                    Resolved this market
                  </motion.span>
                )}
              </div>

              <div className="meter mt-4">
                <motion.div
                  className={`h-full ${
                    latest.verdict === "yes" &&
                    latest.confidence >= market.confidenceThreshold
                      ? "bg-copper"
                      : "bg-muted"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${latest.confidence * 100}%` }}
                  transition={{ duration: 0.8, ease }}
                />
              </div>
              {/* The confidence bar only gates a YES. Printing "needs 72% to
                  settle" under a confident NO made it look like the market
                  should have resolved and did not. */}
              <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                {settlementNote(latest, market)}
              </p>

              <p className="mt-4 text-sm leading-relaxed text-muted">
                {latest.reasoning}
              </p>
              <p className="mt-2 font-mono text-[11px] text-faint">
                {latest.authenticity.detail}
              </p>
              {latest.stages && latest.stages.degraded.length > 0 && (
                <p className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 font-mono text-[11px] text-warn">
                  Ran on {latest.stages.completed} of {latest.stages.total}{" "}
                  stages. Unavailable: {latest.stages.degraded.join(", ")}. A
                  reading missing a judge cannot settle a market.
                </p>
              )}
              {latest.consensus && (
                <p className="mt-1 font-mono text-[11px] text-faint">
                  Dual judges: A={latest.consensus.judgeA} · B=
                  {latest.consensus.judgeB} ·{" "}
                  {latest.consensus.agreed ? "agreed" : "split (no settle YES)"}
                </p>
              )}

              {latest.settled && (
                <button
                  type="button"
                  className="btn-ghost mt-4 text-xs text-copper"
                  onClick={async () => {
                    const text = shareMarketSettled({
                      handle: user?.handle ?? "anon",
                      market,
                      tick: latest,
                      appUrl:
                        process.env.NEXT_PUBLIC_APP_URL ||
                        window.location.origin,
                    });
                    try {
                      await navigator.clipboard.writeText(text);
                    } catch {
                      /* ignore */
                    }
                    openShare(text);
                  }}
                >
                  Share settle card
                </button>
              )}

              {latest.sources.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    Evidence on the record
                  </h3>
                  <motion.ul
                    variants={stagger(0.05, 0.06)}
                    initial="hidden"
                    animate="show"
                    className="mt-2 space-y-2"
                  >
                    {latest.sources.map((s, i) => (
                      <motion.li
                        key={i}
                        variants={listItem}
                        className="sunken rounded-lg px-3 py-2 text-sm"
                      >
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-ink underline-offset-2 hover:text-copper-hot hover:underline"
                          >
                            {s.title}
                          </a>
                        ) : (
                          <div className="font-medium text-ink">{s.title}</div>
                        )}
                        {s.publishedAt && (
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                            {new Date(s.publishedAt).toLocaleDateString()}
                            {" · "}
                            {relativeAge(s.publishedAt)}
                          </div>
                        )}
                        <div className="mt-0.5 text-muted">{s.snippet}</div>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>
              )}

              <div className="mt-5">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  What this reading cost
                </h3>
                <ProofTrace proofs={latest.proofs} network={network} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-5">
        <motion.div variants={fadeUp} className="terminal rounded-xl p-4 font-mono text-[11px]">
          <div className="mb-2 text-[9px] uppercase tracking-[0.2em] opacity-60">
            Activity
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {log.length === 0 && (
                <div className="opacity-50">
                  Waiting. Place a position or run the oracle.
                </div>
              )}
              {log.map((line, i) => (
                <motion.div
                  key={`${line}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="break-all"
                >
                  {line}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="panel rounded-xl p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Forecasts
          </h3>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
            {stakes.length === 0 && (
              <li className="text-muted">No forecasts yet.</li>
            )}
            <AnimatePresence initial={false}>
              {[...stakes].reverse().map((s) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between gap-2 border-b border-line py-1.5 font-mono text-xs last:border-0"
                >
                  <span className="text-ink">{s.player}</span>
                  <span className={s.side === "yes" ? "text-yes" : "text-no"}>
                    {s.side.toUpperCase()}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>

        <motion.div variants={fadeUp} className="panel rounded-xl p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Reading history
          </h3>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px] text-muted">
            {ticks.length === 0 && (
              <li>No readings yet. Run the oracle to take one.</li>
            )}
            {ticks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0"
              >
                <span>{new Date(t.at).toLocaleString()}</span>
                <span className={VERDICT_TONE[t.verdict] ?? "text-muted"}>
                  {t.verdict} {(t.confidence * 100).toFixed(0)}%
                  {t.settled ? " *" : ""}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}
