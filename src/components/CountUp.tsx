"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Rolls a number up to its new value instead of snapping. */
export function CountUp({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduce) {
      node.textContent = value.toFixed(decimals);
      from.current = value;
      return;
    }

    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = v.toFixed(decimals);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, decimals, reduce]);

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`}>
      {value.toFixed(decimals)}
    </span>
  );
}
