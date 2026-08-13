"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import { ArrowRightIcon } from "@/components/Icon";

const HEADLINE = [
  [{ t: "Answers you can" }],
  [{ t: "check", accent: true }, { t: ", not" }],
  [{ t: "answers you trust." }],
];

/**
 * A specimen receipt rather than an abstract graphic. The product's entire
 * argument is "here is the paper trail", so the hero shows one.
 */
const RECEIPT = [
  { k: "CLAIM", v: "Major DeFi lending protocol exploited" },
  { k: "VERDICT", v: "SUPPORTED", tone: "yes" as const },
  { k: "CONFIDENCE", v: "88%" },
  { k: "EVIDENCE", v: "4 sources · newest 6h old" },
  { k: "AUTHENTICITY", v: "clean" },
  { k: "JUDGE A", v: "yes · 0.91" },
  { k: "JUDGE B", v: "yes · 0.85" },
  { k: "PAID", v: "0.0400 USDC" },
  { k: "RECEIPT", v: "0x7a3f…c2e1" },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="glass relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14 lg:py-16">
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="eyebrow"
          >
            Multi-miner verification oracle
          </motion.p>

          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.08] tracking-tight sm:mt-5 sm:text-5xl lg:text-[3.4rem]">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "108%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.72,
                    delay: 0.1 + li * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {line.map((part, pi) => (
                    <span key={pi} className={part.accent ? "text-signal" : undefined}>
                      {part.t}
                    </span>
                  ))}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease }}
            className="mt-5 max-w-xl leading-relaxed text-muted sm:mt-6 sm:text-lg"
          >
            Four independent miners check a claim. Two judges have to agree
            before it says yes, and when they disagree it refuses to answer.
            Every source is dated, every payment has a receipt.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
            className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap"
          >
            <Link href="/verify" className="btn-primary justify-center">
              Check a claim <ArrowRightIcon size={15} />
            </Link>
            <Link href="/docs" className="btn-ghost justify-center">
              How it works
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint sm:mt-10"
          >
            <li>No single model</li>
            <li>Dated sources</li>
            <li>On-chain receipts</li>
            <li>Refuses when unsure</li>
          </motion.ul>
        </div>

        {/* Specimen receipt */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease }}
          className="border border-line bg-sunken"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Specimen verdict
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-yes" />
              settled
            </span>
          </div>

          <dl className="px-4 py-1">
            {RECEIPT.map((row, i) => (
              <motion.div
                key={row.k}
                initial={reduce ? undefined : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.5 + i * 0.055, ease }}
                className="kv"
              >
                <dt>{row.k}</dt>
                <dd
                  className={`font-mono text-[13px] ${
                    row.tone === "yes" ? "font-semibold text-yes" : ""
                  }`}
                >
                  {row.v}
                </dd>
              </motion.div>
            ))}
          </dl>

          <div className="border-t border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Every verdict gets a page like this
            <span className="caret ml-1 text-signal">_</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
