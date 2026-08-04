"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { SignalMark } from "@/components/brand/SignalMark";
import { ease } from "@/lib/motion";

const HEADLINE = [
  [{ t: "Markets that settle" }],
  [{ t: "when the " }, { t: "evidence", accent: true }],
  [{ t: "checks out." }],
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const markY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 70]);
  const markFade = useTransform(scrollYProgress, [0, 0.85], [1, 0.15]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 26]);

  return (
    <section
      ref={ref}
      className="panel relative overflow-hidden rounded-2xl px-6 py-14 sm:px-10 sm:py-20"
    >
      <div className="pointer-events-none absolute -right-32 -top-24 h-80 w-80 rounded-full bg-signal/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-copper/10 blur-3xl" />

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div style={{ y: copyY }}>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="eyebrow"
          >
            Evidence-settled prediction markets
          </motion.p>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "108%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.75,
                    delay: 0.12 + li * 0.09,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {line.map((part, pi) => (
                    <span
                      key={pi}
                      className={part.accent ? "text-copper-hot" : undefined}
                    >
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
            transition={{ duration: 0.6, delay: 0.42, ease }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
          >
            Take a side on a claim. When the oracle runs, it gathers live
            coverage, scores it for authenticity, and reasons over what
            survives. Clear the bar and the pot pays out on its own.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.52, ease }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/markets" className="btn-primary text-sm">
              Browse open markets
            </Link>
            <Link href="/challenge" className="btn-ghost text-sm">
              Try to fool the oracle
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.72 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint"
          >
            <li>No moderator</li>
            <li>Three independent stages</li>
            <li>Every verdict receipted</li>
          </motion.ul>
        </motion.div>

        <motion.div
          style={{ y: markY, opacity: markFade }}
          className="relative mx-auto hidden aspect-square w-full max-w-[340px] items-center justify-center lg:flex"
        >
          {/* orbit rings */}
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute rounded-full border border-dashed border-copper/20"
              style={{
                width: `${72 + i * 22}%`,
                height: `${72 + i * 22}%`,
              }}
              animate={reduce ? undefined : { rotate: i === 0 ? 360 : -360 }}
              transition={{
                duration: 46 + i * 24,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="relative text-copper"
          >
            <SignalMark size={220} animated idle gradient />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
