"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The four-miner topology as artwork: each stage sends a pulse down its own
 * curve into a fusion hub, which emits one verdict. Drawn rather than
 * photographed so it stays sharp, themeable, and honest about the architecture.
 */

const NODES = [
  { label: "Evidence", miner: "202", y: 70, tint: "var(--evidence)" },
  { label: "Authenticity", miner: "115", y: 140, tint: "var(--authenticity)" },
  { label: "Judge A", miner: "110", y: 210, tint: "var(--judgment)" },
  { label: "Judge B", miner: "104", y: 280, tint: "var(--signal)" },
];

const HUB_X = 400;
const HUB_Y = 175;
const VERDICT_X = 612;

function curve(y: number) {
  return `M150 ${y} C 250 ${y}, 290 ${HUB_Y}, ${HUB_X} ${HUB_Y}`;
}

export function MinerConstellation() {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 720 350"
      className="h-auto w-full"
      role="img"
      aria-label="Four Telegraph miners feeding one fused verdict"
    >
      <defs>
        <radialGradient id="hub-glow">
          <stop offset="0%" stopColor="var(--copper-hot)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--copper)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="verdict-line" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--copper)" />
          <stop offset="100%" stopColor="var(--signal)" />
        </linearGradient>
      </defs>

      {/* hub halo */}
      <circle cx={HUB_X} cy={HUB_Y} r="90" fill="url(#hub-glow)" />

      {NODES.map((n, i) => (
        <g key={n.miner}>
          {/* resting wire */}
          <path
            d={curve(n.y)}
            fill="none"
            stroke={n.tint}
            strokeWidth="1.25"
            opacity="0.28"
          />
          {/* travelling pulse */}
          {!reduce && (
            <motion.path
              d={curve(n.y)}
              fill="none"
              stroke={n.tint}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="18 420"
              initial={{ strokeDashoffset: 438 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.55,
              }}
            />
          )}

          {/* miner node */}
          <circle cx="150" cy={n.y} r="7" fill={n.tint} />
          <circle
            cx="150"
            cy={n.y}
            r="14"
            fill="none"
            stroke={n.tint}
            strokeWidth="1"
            opacity="0.35"
          />
          <text
            x="126"
            y={n.y - 6}
            textAnchor="end"
            className="font-sans"
            fontSize="15"
            fontWeight="600"
            fill="var(--ink)"
          >
            {n.label}
          </text>
          <text
            x="126"
            y={n.y + 12}
            textAnchor="end"
            className="font-mono"
            fontSize="12"
            fill="var(--faint)"
          >
            miner {n.miner}
          </text>
        </g>
      ))}

      {/* fusion hub */}
      <circle
        cx={HUB_X}
        cy={HUB_Y}
        r="26"
        fill="var(--surface)"
        stroke="var(--copper)"
        strokeWidth="1.5"
      />
      {!reduce && (
        <motion.circle
          cx={HUB_X}
          cy={HUB_Y}
          r="26"
          fill="none"
          stroke="var(--copper-hot)"
          strokeWidth="1.5"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${HUB_X}px ${HUB_Y}px` }}
        />
      )}
      <circle cx={HUB_X} cy={HUB_Y} r="8" fill="var(--copper-hot)" />

      {/* verdict */}
      <path
        d={`M${HUB_X + 28} ${HUB_Y} L${VERDICT_X - 34} ${HUB_Y}`}
        stroke="url(#verdict-line)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x={VERDICT_X - 30}
        y={HUB_Y - 30}
        width="112"
        height="60"
        rx="14"
        fill="color-mix(in srgb, var(--signal) 14%, transparent)"
        stroke="var(--signal)"
        strokeWidth="1.5"
      />
      <text
        x={VERDICT_X + 26}
        y={HUB_Y - 4}
        textAnchor="middle"
        className="font-sans"
        fontSize="17"
        fontWeight="600"
        fill="var(--ink)"
      >
        Verdict
      </text>
      <text
        x={VERDICT_X + 26}
        y={HUB_Y + 16}
        textAnchor="middle"
        className="font-mono"
        fontSize="12"
        fill="var(--copper)"
      >
        + receipts
      </text>
    </svg>
  );
}
