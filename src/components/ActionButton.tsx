"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Button that owns its own busy state so no action can look inert.
 * While pending it swaps in a spinner, keeps its label, blocks repeat
 * clicks, and reports busy state to assistive tech.
 */
export function ActionButton({
  children,
  pending = false,
  pendingLabel,
  disabled,
  onClick,
  variant = "primary",
  className,
  type = "button",
}: {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const reduce = useReducedMotion();
  const base = variant === "primary" ? "btn-primary" : "btn-ghost";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      whileTap={reduce || pending ? undefined : { scale: 0.97 }}
      className={`${base} ${className ?? ""}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span
            key="pending"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            <Spinner />
            {pendingLabel ?? "Working"}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
      style={{ animationDuration: "0.7s" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
