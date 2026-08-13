"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ChallengeAttempt } from "@/lib/types";
import { ease, fadeUp, listItem, stagger } from "@/lib/motion";
import { ProofTrace } from "./ProofTrace";
import { useAuth } from "@/hooks/useAuth";
import { openShare, shareBreak } from "@/lib/share";

const SAMPLE = `BREAKING: Multiple independent security firms have confirmed a critical exploit affecting a major DeFi lending protocol. Over $40M in user funds are reportedly at risk as the attacker drained the ethereum vault within minutes. On-chain analysts traced the flow to a mixer. Protocol team has not yet issued an official statement.`;

const MIN_CHARS = 80;

export function ChallengeClient({
  initial,
  network,
}: {
  initial: ChallengeAttempt[];
  network: string;
}) {
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const [player, setPlayer] = useState("adversary");
  const [text, setText] = useState(SAMPLE);
  const effectivePlayer = user?.handle || player;
  const [attempts, setAttempts] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ChallengeAttempt | null>(null);

  const tooShort = text.trim().length < MIN_CHARS;

  function formatApiError(data: {
    detail?: unknown;
    error?: unknown;
  }): string {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    return "That attempt failed";
  }

  async function submit() {
    if (tooShort) {
      setError(
        `Need at least ${MIN_CHARS} characters. You have ${text.trim().length}. Add more detail so the oracle has something to judge.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: effectivePlayer, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data));
      setLast(data.attempt);
      setAttempts((a) => [data.attempt, ...a]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That attempt failed");
    } finally {
      setBusy(false);
    }
  }

  function shareText(a: ChallengeAttempt) {
    return shareBreak({
      handle: effectivePlayer,
      attempt: a,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
    });
  }

  return (
    <motion.div
      variants={stagger(0.05, 0.1)}
      initial="hidden"
      animate="show"
      className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <motion.section variants={fadeUp} className="panel-hot p-6">
        <p className="eyebrow">Red team</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Break the oracle
        </h1>

        {/* This page and /verify run the identical pipeline, which is exactly
            why people read them as duplicates. State the difference up front
            instead of hoping the name carries it. */}
        <div className="mt-4 border border-line">
          <div className="grid grid-cols-2 divide-x divide-line">
            <div className="p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Verify asks
              </p>
              <p className="mt-1 text-sm text-ink">Is this true?</p>
            </div>
            <div className="p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                This asks
              </p>
              <p className="mt-1 text-sm text-ink">Can you make it lie?</p>
            </div>
          </div>
        </div>

        <p className="mt-4 leading-relaxed text-muted">
          Write a claim you know is <strong className="text-ink">false</strong>,
          but convincing enough that four miners believe it anyway. Same pipeline
          as Verify, opposite goal: here a confident YES means{" "}
          <em className="text-ink not-italic">you won</em> and the oracle failed.
        </p>

        <label className="mt-6 block text-xs text-muted">
          Handle {user ? "(from wallet)" : ""}
          <input
            value={effectivePlayer}
            onChange={(e) => setPlayer(e.target.value)}
            disabled={Boolean(user)}
            className="input-desk mt-1"
            placeholder="your handle"
          />
        </label>

        <label className="mt-4 block text-xs text-muted">
          <span className="flex items-baseline justify-between">
            Your claim
            <span
              className={`font-mono text-[10px] tabular ${
                tooShort ? "text-warn" : "text-faint"
              }`}
            >
              {text.trim().length} / {MIN_CHARS} min
            </span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="input-desk mt-1 resize-y font-mono text-sm leading-relaxed"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <motion.button
            type="button"
            disabled={busy || tooShort}
            onClick={submit}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className="btn-primary text-sm"
          >
            {busy ? (
              <>
                <motion.span
                  className="inline-block h-2 w-2 rounded-full bg-current"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ repeat: Infinity, duration: 0.9 }}
                />
                Judging your claim
              </>
            ) : (
              "Submit attempt"
            )}
          </motion.button>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="btn-ghost text-sm"
          >
            Load example
          </button>
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

        <AnimatePresence mode="wait">
          {last && (
            <motion.div
              key={last.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease }}
              className="sunken mt-6 rounded-xl p-5"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="font-mono text-4xl font-semibold text-copper-hot tabular"
                >
                  {(last.foolScore * 100).toFixed(1)}
                </motion.span>
                <span className="text-sm text-muted">out of 100</span>
                {last.brokeThreshold && (
                  <span className="rounded-full border border-warn/50 bg-warn/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warn">
                    Cleared the bar
                  </span>
                )}
              </div>

              <div className="meter mt-3">
                <motion.div
                  className="h-full bg-copper"
                  initial={{ width: 0 }}
                  animate={{ width: `${last.foolScore * 100}%` }}
                  transition={{ duration: 0.8, ease }}
                />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted">
                {last.reasoning}
              </p>

              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-wide text-faint">
                <span>Verdict {last.verdict}</span>
                <span>Confidence {(last.confidence * 100).toFixed(0)}%</span>
                <span>
                  Flagged synthetic {last.aiDetected ? "yes" : "no"}
                </span>
              </div>

              <div className="mt-4">
                <ProofTrace proofs={last.proofs} network={network} />
              </div>

              <button
                type="button"
                className="btn-ghost mt-4 text-xs text-copper"
                onClick={async () => {
                  const t = shareText(last);
                  try {
                    await navigator.clipboard.writeText(t);
                  } catch {
                    // clipboard unavailable
                  }
                  openShare(t);
                }}
              >
                Share this score
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.section variants={fadeUp} className="panel rounded-xl p-6">
        <h2 className="eyebrow">Recent attempts</h2>
        <motion.ul
          variants={stagger(0.04, 0.05)}
          initial="hidden"
          animate="show"
          className="mt-4 max-h-[34rem] space-y-2.5 overflow-y-auto pr-1"
        >
          {attempts.length === 0 && (
            <li className="text-sm text-muted">
              Nobody has tried yet. Go first.
            </li>
          )}
          {attempts.map((a) => (
            <motion.li
              key={a.id}
              variants={listItem}
              className="sunken rounded-lg p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{a.player}</span>
                <span className="font-mono text-copper-hot tabular">
                  {(a.foolScore * 100).toFixed(1)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                {a.text}
              </p>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-faint">
                {a.verdict} / flagged {a.aiDetected ? "yes" : "no"} /{" "}
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>
    </motion.div>
  );
}
