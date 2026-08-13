"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DocMeta } from "@/lib/docs";
import { SidebarIcon } from "./Icon";

/**
 * Docs navigation as a drawer at every breakpoint.
 *
 * It was an inline column that collapsed, which meant the control only existed
 * at the top of the page: once you had scrolled into a long document there was
 * no way to jump elsewhere without scrolling back. The trigger is fixed to the
 * viewport now, so the sidebar opens and closes from anywhere on the page.
 */
export function DocsShell({
  docs,
  children,
}: {
  docs: (DocMeta & { href: string })[];
  children: React.ReactNode;
}) {
  const path = usePathname();

  // The drawer remembers the route it opened on, so any navigation (including
  // browser back) closes it by derivation rather than by an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt !== null && openAt === path;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const current = docs.find((d) => d.href === path);

  return (
    <>
      {/* Fixed trigger. Sits in the gutter beside the centred column on wide
          screens and tucks into the bottom-left corner on small ones. */}
      <motion.button
        type="button"
        onClick={() => setOpenAt(path)}
        aria-expanded={open}
        aria-controls="docs-drawer"
        initial={false}
        animate={{ opacity: open ? 0 : 1, pointerEvents: open ? "none" : "auto" }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-5 left-4 z-40 flex items-center gap-2 border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink shadow-lg transition-colors hover:border-signal hover:text-signal sm:bottom-6 sm:left-6"
      >
        <SidebarIcon size={15} />
        <span className="max-w-[9rem] truncate">
          {current?.title ?? "Documentation"}
        </span>
      </motion.button>

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
              onClick={() => setOpenAt(null)}
              className="fixed inset-0 z-50 cursor-default bg-black/60"
            />
            <motion.nav
              id="docs-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.24, ease: [0.2, 0.8, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[85vw] flex-col border-r border-line bg-background"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  Documentation
                </span>
                <button
                  type="button"
                  onClick={() => setOpenAt(null)}
                  aria-label="Close documentation menu"
                  className="flex h-7 w-7 items-center justify-center border border-line text-faint transition-colors hover:border-signal hover:text-signal"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 5l14 14M19 5L5 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                    />
                  </svg>
                </button>
              </div>

              <ul className="flex-1 overflow-y-auto p-3">
                {docs.map((d) => {
                  const active = path === d.href;
                  return (
                    <li key={d.slug}>
                      <Link
                        href={d.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpenAt(null)}
                        className={`block border-l-2 py-2.5 pl-3 pr-2 transition-colors ${
                          active
                            ? "border-signal bg-signal/5 text-signal"
                            : "border-transparent text-ink hover:bg-sunken"
                        }`}
                      >
                        <span className="block text-sm">{d.title}</span>
                        {d.summary && (
                          <span className="mt-0.5 block text-xs leading-snug text-faint">
                            {d.summary}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {children}
    </>
  );
}
