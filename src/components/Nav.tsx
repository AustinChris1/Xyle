"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { SignalMark } from "./brand/SignalMark";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/challenge", label: "Adversary" },
  { href: "/ledger", label: "Ledger" },
  { href: "/leaderboard", label: "Board" },
];

export function Nav() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <motion.span
            whileHover={{ rotate: 24, scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="flex text-copper"
          >
            <SignalMark size={34} />
          </motion.span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              Signal Arena
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
              Verifiable oracle · 4 miners
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                  active
                    ? "text-copper-hot"
                    : "text-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded border border-copper/25 bg-copper/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {l.label}
              </Link>
            );
          })}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
