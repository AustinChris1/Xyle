"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { XyleMark } from "./brand/XyleMark";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectWallet } from "./ConnectWallet";
import { ChevronDownIcon } from "./Icon";

/**
 * Seven equal links taught nobody what this app is for. They are grouped now:
 * the two things you come here to do stay in the bar, and everything that
 * exists to prove the app works moves behind one menu.
 */
const primary = [
  { href: "/verify", label: "Verify" },
  { href: "/markets", label: "Markets" },
];

const proof = {
  label: "Evidence",
  hint: "Whether any of this can be trusted",
  items: [
    { href: "/pulse", label: "Pulse", hint: "Which miners actually work" },
    { href: "/calibration", label: "Calibration", hint: "Is the confidence real" },
    { href: "/ledger", label: "Ledger", hint: "Every call, every cent" },
  ],
};

const play = {
  label: "Play",
  hint: "Same engine, for sport",
  items: [
    { href: "/challenge", label: "Break it", hint: "Try to make the oracle lie" },
    { href: "/leaderboard", label: "Leaderboard", hint: "Who calls it right" },
  ],
};

const groups = [proof, play];
const trailing = [{ href: "/docs", label: "Docs" }];

export function Nav() {
  const path = usePathname();
  const reduce = useReducedMotion();

  // Both menus remember the route they opened on, so any navigation
  // (including browser back) closes them by derivation rather than an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const open = openAt !== null && openAt === path;
  const menu = menuAt !== null && menuAt.endsWith(`@${path}`) ? menuAt.split("@")[0] : null;
  const setOpen = (next: boolean) => setOpenAt(next ? path : null);
  const setMenu = (label: string | null) =>
    setMenuAt(label ? `${label}@${path}` : null);

  const barRef = useRef<HTMLDivElement>(null);

  // Lock scroll and allow Escape while the drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenAt(null);
      setMenuAt(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, menu]);

  // A dropdown left open while the pointer wanders elsewhere is noise.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setMenuAt(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const groupActive = (items: { href: string }[]) => items.some((i) => isActive(i.href));

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/95 backdrop-blur-sm">
      <div
        ref={barRef}
        className="relative z-50 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <motion.span
            whileHover={reduce ? undefined : { rotate: 18 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="flex text-signal"
          >
            <XyleMark size={30} />
          </motion.span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              Xyle
            </div>
            <div className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-faint sm:block">
              Verified answers, with receipts
            </div>
          </div>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {primary.map((l) => (
            <NavLink key={l.href} {...l} active={isActive(l.href)} />
          ))}

          {groups.map((g) => {
            const active = groupActive(g.items);
            const isOpen = menu === g.label;
            return (
              <div key={g.label} className="relative">
                <button
                  type="button"
                  onClick={() => setMenu(isOpen ? null : g.label)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm transition-colors ${
                    active || isOpen ? "text-signal" : "text-muted hover:text-ink"
                  }`}
                >
                  {g.label}
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.16 }}
                    className="flex"
                  >
                    <ChevronDownIcon size={13} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 top-full z-50 mt-2 w-64 border border-line bg-surface p-1.5"
                    >
                      {/* No rules between items. Hover fill separates them,
                          which is quieter than a divider per row. */}
                      {g.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenu(null)}
                          className={`block px-2.5 py-2 transition-colors hover:bg-sunken ${
                            isActive(item.href) ? "text-signal" : "text-ink"
                          }`}
                        >
                          <span className="block text-sm">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-faint">
                            {item.hint}
                          </span>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {trailing.map((l) => (
            <NavLink key={l.href} {...l} active={isActive(l.href)} />
          ))}

          <span className="w-3" />
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
            className="flex h-9 w-9 items-center justify-center border border-line text-ink transition-colors hover:border-signal hover:text-signal"
          >
            <span className="sr-only">Menu</span>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <motion.path
                d="M3 6h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                animate={open ? { d: "M5 5l14 14" } : { d: "M3 6h18" }}
                transition={{ duration: 0.2 }}
              />
              <motion.path
                d="M3 12h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                animate={{ opacity: open ? 0 : 1 }}
                transition={{ duration: 0.12 }}
              />
              <motion.path
                d="M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                animate={open ? { d: "M5 19l14 -14" } : { d: "M3 18h18" }}
                transition={{ duration: 0.2 }}
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
              className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden"
            />
            <motion.nav
              id="mobile-nav"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.3, 1] }}
              className="relative z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-background lg:hidden"
            >
              <div className="mx-auto max-w-6xl px-4 py-4">
                {/* The two things you actually came to do, given real weight. */}
                <div className="grid grid-cols-2 gap-2">
                  {primary.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`border px-4 py-4 text-base transition-colors ${
                        isActive(l.href)
                          ? "border-signal bg-signal/10 text-signal"
                          : "border-line text-ink hover:border-signal"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>

                {/* Groups are separated by their label alone. A rule under
                    every row turned the drawer into a ruled notepad. */}
                {groups.map((g) => (
                  <div key={g.label} className="mt-6">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                      {g.label}
                    </p>
                    <ul>
                      {g.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`-mx-2 flex items-baseline justify-between gap-3 px-2 py-2.5 transition-colors ${
                              isActive(item.href)
                                ? "text-signal"
                                : "text-ink hover:text-signal"
                            }`}
                          >
                            <span className="text-sm">{item.label}</span>
                            <span className="text-right text-xs text-faint">
                              {item.hint}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="mt-6">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    Account
                  </p>
                  {[
                    { href: "/desk", label: "Desk" },
                    { href: "/docs", label: "Docs" },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`-mx-2 flex px-2 py-2.5 text-sm transition-colors ${
                        isActive(l.href) ? "text-signal" : "text-ink hover:text-signal"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                  <div className="pt-4">
                    <ConnectWallet />
                  </div>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative px-3 py-1.5 text-sm transition-colors ${
        active ? "text-signal" : "text-muted hover:text-ink"
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-2 -bottom-[13px] h-px bg-signal"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {label}
    </Link>
  );
}
