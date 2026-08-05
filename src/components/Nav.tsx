"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SignalMark } from "./brand/SignalMark";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectWallet } from "./ConnectWallet";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/challenge", label: "Adversary" },
  { href: "/desk", label: "Desk" },
  { href: "/ledger", label: "Ledger" },
  { href: "/leaderboard", label: "Board" },
];

export function Nav() {
  const path = usePathname();
  const reduce = useReducedMotion();
  // The drawer remembers which route it was opened on, so any navigation
  // (including browser back) closes it by derivation rather than an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt !== null && openAt === path;
  const setOpen = (next: boolean) => setOpenAt(next ? path : null);

  // Lock scroll and allow Escape while the drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="relative z-50 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <motion.span
            whileHover={reduce ? undefined : { rotate: 24, scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="flex text-copper"
          >
            <SignalMark size={32} />
          </motion.span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              Signal Arena
            </div>
            <div className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-muted sm:block">
              Verifiable oracle · 4 miners
            </div>
          </div>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded px-3 py-1.5 text-sm transition-colors ${
                  active ? "text-copper-hot" : "text-muted hover:text-ink"
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
          <span className="mx-1 h-5 w-px bg-line" />
          <ConnectWallet />
          <ThemeToggle />
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-copper/40 hover:text-copper-hot"
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <motion.path
                d="M3 6h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={open ? { d: "M5 5l14 14" } : { d: "M3 6h18" }}
                transition={{ duration: 0.22 }}
              />
              <motion.path
                d="M3 12h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ opacity: open ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
              <motion.path
                d="M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={open ? { d: "M5 19l14 -14" } : { d: "M3 18h18" }}
                transition={{ duration: 0.22 }}
              />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.nav
              id="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
              className="relative z-50 overflow-hidden border-t border-line bg-background/95 backdrop-blur-xl lg:hidden"
            >
              <motion.ul
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
                }}
                className="mx-auto max-w-6xl space-y-1 px-4 py-4"
              >
                {links.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <motion.li
                      key={l.href}
                      variants={{
                        hidden: { opacity: 0, x: -12 },
                        show: { opacity: 1, x: 0 },
                      }}
                    >
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-base transition-colors ${
                          active
                            ? "border-copper/30 bg-copper/10 text-copper-hot"
                            : "border-transparent text-muted hover:bg-copper/5 hover:text-ink"
                        }`}
                      >
                        {l.label}
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-copper-hot" />
                        )}
                      </Link>
                    </motion.li>
                  );
                })}
                <motion.li
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show: { opacity: 1, x: 0 },
                  }}
                  className="border-t border-line pt-3"
                >
                  <ConnectWallet />
                </motion.li>
              </motion.ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
