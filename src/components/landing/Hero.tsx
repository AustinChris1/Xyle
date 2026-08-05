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
      className="panel relative overflow-hidden rounded-2xl px-5 py-10 sm:px-10 sm:py-16 lg:py-20"
    >
      <div className="relative grid items-center gap-10 sm:gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div style={{ y: copyY }}>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="eyebrow"
          >
            Evidence-settled prediction markets
          </motion.p>

          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.08] tracking-tight sm:mt-5 sm:text-5xl lg:text-6xl">
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
            className="mt-5 max-w-xl leading-relaxed text-muted sm:mt-6 sm:text-lg"
          >
            Take a side on a claim. When the oracle runs, it gathers live
            coverage, scores it for authenticity, and reasons over what
            survives. Clear the bar and the pot pays out on its own.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.52, ease }}
            className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap"
          >
            <Link href="/markets" className="btn-primary justify-center text-sm">
              Browse open markets
            </Link>
            <Link href="/challenge" className="btn-ghost justify-center text-sm">
              Try to fool the oracle
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.72 }}
            className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint sm:mt-10 sm:gap-x-6"
          >
            <li>No moderator</li>
            <li>Four independent miners</li>
            <li>Every verdict receipted</li>
          </motion.ul>
        </motion.div>

        <motion.div
          style={{ y: markY, opacity: markFade }}
          className="relative mx-auto flex aspect-square w-full max-w-[190px] items-center justify-center sm:max-w-[240px] lg:max-w-[320px]"
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
            {/* CSS wins over the SVG width/height attributes, so the mark
                tracks its container instead of needing a resize listener. */}
            <SignalMark
              size={220}
              animated
              idle
              gradient
              className="h-[120px] w-[120px] sm:h-[152px] sm:w-[152px] lg:h-[200px] lg:w-[200px]"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
