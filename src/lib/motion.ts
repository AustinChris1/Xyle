import type { Transition, Variants } from "framer-motion";

/** Shared easing so every surface in the app decelerates the same way. */
export const ease = [0.22, 0.61, 0.36, 1] as const;

export const spring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 32,
  mass: 0.8,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.18 } },
};

/** Parent wrapper that releases children one after another. */
export function stagger(delayChildren = 0.04, staggerChildren = 0.07): Variants {
  return {
    hidden: {},
    show: {
      transition: { delayChildren, staggerChildren },
    },
  };
}

export const listItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease } },
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } },
};
