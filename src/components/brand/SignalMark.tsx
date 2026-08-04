"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The Signal Arena mark.
 *
 * A settlement seal: a segmented ring with three tapered signals entering
 * through its gaps and converging on a single node. The three signals are the
 * three settlement stages, the node is the verdict they agree on, and the
 * broken ring is the seal that only closes once they do.
 *
 * Geometry lives on a 64 unit grid so it stays crisp from 16px to 320px.
 */

const RING = "M59 32A27 27 0 0 1 5 32A27 27 0 0 1 59 32";

/**
 * Ring circumference is 2 * PI * 27 = 169.65. A 47.12 dash with a 9.42 gap
 * repeats three times and, shifted by 37.7, puts the gaps at 30, 150 and 270
 * degrees, exactly where each signal enters.
 */
const RING_DASH = "47.12 9.42";
const RING_OFFSET = 37.7;

const RAYS = [
  "M36 11L28 11L30.8 24L33.2 24Z",
  "M48.19 45.96L52.19 39.04L39.53 34.96L38.33 37.04Z",
  "M11.81 39.04L15.81 45.96L25.67 37.04L24.47 34.96Z",
];

export function SignalMark({
  size = 40,
  animated = false,
  idle = false,
  gradient = false,
  className,
  title = "Signal Arena",
}: {
  size?: number;
  /** Plays the convergence sequence on mount. */
  animated?: boolean;
  /** Keeps the seal drifting and the node breathing after it lands. */
  idle?: boolean;
  gradient?: boolean;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const drift = idle && !reduce;
  const id = gradient ? "signal-mark-gradient" : undefined;
  const stroke = id ? `url(#${id})` : "currentColor";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      fill="none"
    >
      {gradient && (
        <defs>
          <linearGradient id={id} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--copper-hot)" />
            <stop offset="55%" stopColor="var(--copper)" />
            <stop offset="100%" stopColor="var(--signal)" />
          </linearGradient>
        </defs>
      )}

      {/* seal */}
      <motion.path
        d={RING}
        stroke={stroke}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeDasharray={RING_DASH}
        strokeDashoffset={RING_OFFSET}
        opacity={0.75}
        style={{ transformOrigin: "32px 32px" }}
        initial={play ? { opacity: 0, rotate: -50, scale: 0.85 } : false}
        animate={
          drift
            ? { opacity: 0.75, rotate: [0, 360], scale: 1 }
            : { opacity: 0.75, rotate: 0, scale: 1 }
        }
        transition={
          drift
            ? {
                opacity: { duration: 0.5 },
                scale: { type: "spring", stiffness: 200, damping: 22 },
                rotate: { duration: 64, repeat: Infinity, ease: "linear" },
              }
            : { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }
        }
      />

      {/* converging signals */}
      {RAYS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          fill={stroke}
          style={{ transformOrigin: "32px 32px" }}
          initial={play ? { opacity: 0, scale: 1.75 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.55,
            delay: 0.15 + i * 0.11,
            ease: [0.22, 0.61, 0.36, 1],
          }}
        />
      ))}

      {/* the verdict they agree on */}
      <motion.circle
        cx={32}
        cy={32}
        r={4.5}
        fill={stroke}
        style={{ transformOrigin: "32px 32px" }}
        initial={play ? { scale: 0 } : false}
        animate={drift ? { scale: [1, 1.13, 1] } : { scale: 1 }}
        transition={
          drift
            ? { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.7 }
            : { type: "spring", stiffness: 420, damping: 16, delay: 0.5 }
        }
      />

      {/* settlement pulse */}
      {drift && (
        <motion.circle
          cx={32}
          cy={32}
          r={4.5}
          stroke={stroke}
          strokeWidth={1.5}
          style={{ transformOrigin: "32px 32px" }}
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: [1, 3.4], opacity: [0.7, 0] }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.7,
          }}
        />
      )}
    </svg>
  );
}
