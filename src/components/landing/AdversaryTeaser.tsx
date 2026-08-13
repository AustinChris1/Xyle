"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { ease } from "@/lib/motion";
import { CountUp } from "@/components/CountUp";

const SCORE = 62.4;

const SAMPLE =
  "BREAKING: Multiple independent security firms have confirmed a critical exploit affecting a major DeFi lending protocol. Over $40M in user funds are reportedly at risk.";

export function AdversaryTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();

  const circumference = 2 * Math.PI * 46;

  return (
    <div
      ref={ref}
      className="panel-hot grid gap-8 rounded-2xl p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center"
    >
      <div>
        <p className="eyebrow">Red team</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Think you can break it? Everyone gets a turn.
        </h2>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">
          Write a claim convincing enough to push the oracle toward a false YES.
          Every attempt runs the same three stages a real settlement does, so a
          high score is a genuine weakness, published for anyone to see.
        </p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={seen ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="sunken mt-6 rounded-lg p-3 font-mono text-xs leading-relaxed text-muted"
        >
          {SAMPLE}
        </motion.p>

        <Link href="/challenge" className="btn-primary mt-6 text-sm">
          Take a shot
        </Link>
      </div>

      <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--line)"
            strokeWidth="4"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--copper-hot)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={
              seen
                ? {
                    strokeDashoffset:
                      circumference - (SCORE / 100) * circumference,
                  }
                : {}
            }
            transition={{ duration: reduce ? 0 : 1.4, ease, delay: 0.25 }}
          />
        </svg>
        <div className="text-center">
          <div className="font-mono text-4xl font-semibold text-copper-hot">
            {seen ? <CountUp value={SCORE} decimals={1} /> : "0.0"}
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
            Best attempt
          </div>
        </div>
      </div>
    </div>
  );
}
