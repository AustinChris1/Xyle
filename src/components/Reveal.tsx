"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

/** Fades a section in the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease, delay }}
    >
      {children}
    </motion.div>
  );
}
