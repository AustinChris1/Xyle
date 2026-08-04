"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";

const CLAIM =
  "A major lending protocol was drained for $40M in the last hour.";

const STAGES = [
  {
    name: "Evidence",
    miner: "miner 202",
    result: "4 sources found",
    detail: "Two name the protocol. Two recycle the same unsourced post.",
  },
  {
    name: "Authenticity",
    miner: "miner 110",
    result: "0.81 synthetic",
    detail: "The two recycled sources read as generated wire copy.",
  },
  {
    name: "Judgment",
    miner: "miner 110",
    result: "0.44 confidence",
    detail: "Corroboration too thin once the synthetic coverage is discounted.",
  },
];

/** phase 0 claim, 1 to 3 stages, 4 verdict */
const PHASES = 5;
const TIMINGS = [1600, 1900, 1900, 1900, 3400];

export function SettlementDemo() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? PHASES - 1 : 0);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(
      () => setPhase((p) => (p + 1) % PHASES),
      TIMINGS[phase]
    );
    return () => clearTimeout(t);
  }, [phase, reduce]);

  return (
    <div className="panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          A reading, start to finish
        </span>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: PHASES }).map((_, i) => (
            <motion.span
              key={i}
              className="h-1 rounded-full bg-copper"
              animate={{
                width: i === phase ? 18 : 6,
                opacity: i === phase ? 1 : i < phase ? 0.5 : 0.2,
              }}
              transition={{ duration: 0.3, ease }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
        {/* the claim */}
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Claim under test
          </p>
          <motion.p
            key={`claim-${phase === 0}`}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: phase === 0 ? 1 : 0.75 }}
            transition={{ duration: 0.4 }}
            className="mt-3 text-lg leading-relaxed text-ink"
          >
            {CLAIM}
          </motion.p>

          <div className="mt-6 min-h-[3.5rem]">
            <AnimatePresence mode="wait">
              {phase === 4 && (
                <motion.div
                  key="verdict"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    Settled as
                  </p>
                  <p className="mt-1 font-mono text-3xl font-semibold uppercase text-no">
                    No
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    The pot pays the side that doubted it. No moderator was
                    involved.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* the stages */}
        <ol className="divide-y divide-line">
          {STAGES.map((s, i) => {
            const stagePhase = i + 1;
            const active = phase === stagePhase;
            const done = phase > stagePhase;
            return (
              <li key={s.name} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <motion.span
                    className="relative flex h-2.5 w-2.5 shrink-0 rounded-full"
                    animate={{
                      backgroundColor: active
                        ? "var(--copper-hot)"
                        : done
                          ? "var(--yes)"
                          : "var(--line-strong)",
                      scale: active ? 1.25 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {active && !reduce && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-copper-hot"
                        animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                  </motion.span>

                  <motion.span
                    animate={{ opacity: active || done ? 1 : 0.45 }}
                    className="font-semibold tracking-tight text-ink"
                  >
                    {s.name}
                  </motion.span>

                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                    {s.miner}
                  </span>

                  <AnimatePresence>
                    {(active || done) && (
                      <motion.span
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="ml-auto font-mono text-xs text-copper tabular"
                      >
                        {s.result}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence initial={false}>
                  {(active || done) && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: done ? 0.6 : 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease }}
                      className="pl-[1.4rem] pt-1.5 text-sm leading-relaxed text-muted"
                    >
                      {s.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="border-t border-line px-5 py-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={phase >= 4 ? "paid" : "running"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint"
          >
            {phase >= 4
              ? "3 paid miner calls, 0.03 USDC, every receipt on chain"
              : "Each stage is a metered call to a different Telegraph miner"}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
