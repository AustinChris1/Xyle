"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ease } from "@/lib/motion";

const STAGES = [
  {
    step: "01",
    tint: "var(--evidence)",
    name: "Evidence",
    source: "News miner",
    detail:
      "Pulls live coverage for the market question and keeps the strongest sources on the record, so anyone can check what the verdict was built from.",
  },
  {
    step: "02",
    tint: "var(--authenticity)",
    name: "Authenticity",
    source: "Detector miner",
    detail:
      "Scores that coverage for synthetic wire copy. A story that reads as farmed gets discounted instead of settling a pot.",
  },
  {
    step: "03",
    tint: "var(--judgment)",
    name: "Judgment",
    source: "Two reasoning miners",
    detail:
      "Two independent judges weigh what survived. They must agree, and clear the market's confidence bar, or nothing happens and the market stays open.",
  },
];

export function ScrollPipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.55"],
  });
  const fill = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  return (
    <div ref={ref} className="relative">
      {/* spine */}
      <div className="absolute top-2 bottom-2 left-3.75 w-px bg-line md:left-4.75" />
      <motion.div
        className="absolute top-2 bottom-2 left-3.75 w-px origin-top bg-copper md:left-4.75"
        style={{ scaleY: fill }}
      />

      <ol className="space-y-10">
        {STAGES.map((s, i) => (
          <Stage key={s.step} stage={s} index={i} progress={fill} />
        ))}
      </ol>
    </div>
  );
}

function Stage({
  stage,
  index,
  progress,
}: {
  stage: (typeof STAGES)[number];
  index: number;
  progress: ReturnType<typeof useSpring>;
}) {
  // Each stage lights as the spine passes its own third of the section.
  // Only numbers are interpolated here; the lit dot is a separate layer that
  // fades in over the dim one, so both stay on their theme tokens.
  const start = index / STAGES.length;
  const lit = useTransform(progress, [start, start + 0.12], [0.35, 1]);
  const glow = useTransform(progress, [start, start + 0.12], [0, 1]);
  const swell = useTransform(progress, [start, start + 0.12], [0.85, 1.3]);

  return (
    <motion.li
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease, delay: index * 0.05 }}
      className="relative grid grid-cols-[32px_1fr] gap-4 md:grid-cols-[40px_1fr] md:gap-6"
    >
      <div className="relative flex justify-center pt-4">
        <motion.span
          style={{ scale: swell }}
          className="relative z-10 flex h-2.5 w-2.5 rounded-full ring-4 ring-background"
        >
          <span className="absolute inset-0 rounded-full bg-(--line-strong)" />
          <motion.span
            style={{ opacity: glow, background: stage.tint }}
            className="absolute inset-0 rounded-full"
          />
          <motion.span
            style={{ opacity: glow, background: stage.tint }}
            className="absolute -inset-2 rounded-full blur-md"
          />
        </motion.span>
      </div>

      <motion.div
        style={{ opacity: lit, ["--tint" as string]: stage.tint }}
        className="tinted rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className="font-mono text-[10px] tracking-[0.2em]"
            style={{ color: stage.tint }}
          >
            {stage.step}
          </span>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            {stage.name}
          </h3>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              color: stage.tint,
              background: `color-mix(in srgb, ${stage.tint} 14%, transparent)`,
            }}
          >
            {stage.source}
          </span>
        </div>
        <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
          {stage.detail}
        </p>
      </motion.div>
    </motion.li>
  );
}
