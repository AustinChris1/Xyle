"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DocMeta } from "@/lib/docs";
import { ChevronRightIcon, SidebarIcon } from "./Icon";

const STORAGE_KEY = "xyle.docs.sidebar";

/**
 * The collapsed flag lives in localStorage, which is an external store, so it
 * is read through useSyncExternalStore rather than copied into state by an
 * effect. That keeps the server render (always expanded) from mismatching and
 * avoids the cascading render an effect-then-setState would cause.
 */
const listeners = new Set<() => void>();

function subscribeSidebar(onChange: () => void) {
  listeners.add(onChange);
  // `storage` only fires in other tabs, so same-tab changes are announced by
  // writeCollapsed below.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Private mode or blocked storage. The toggle still works for this render.
  }
  listeners.forEach((l) => l());
}

/**
 * Docs chrome: a retractable left sidebar that persists its state, plus a
 * slide-in drawer on mobile.
 *
 * The sidebar lives in the layout rather than each page so it does not
 * remount, which is what lets it keep scroll position and collapsed state
 * across navigations.
 */
export function DocsShell({
  docs,
  children,
}: {
  docs: (DocMeta & { href: string })[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    readCollapsed,
    () => false
  );

  // The drawer remembers the route it opened on, so any navigation (including
  // browser back) closes it by derivation rather than by an effect.
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawer = drawerAt !== null && drawerAt === path;
  const setDrawer = (next: boolean) => setDrawerAt(next ? path : null);

  useEffect(() => {
    if (!drawer) return;
    // setDrawerAt rather than the setDrawer helper: the helper closes over
    // `path` and so is a new function every render, which would make this
    // effect re-subscribe on each one.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerAt(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const nav = (
    <ul>
      {docs.map((d) => {
        const active = path === d.href;
        return (
          <li key={d.slug}>
            <Link
              href={d.href}
              aria-current={active ? "page" : undefined}
              className={`block border-l-2 py-2 pl-3 pr-2 text-sm transition-colors ${
                active
                  ? "border-signal bg-signal/5 text-signal"
                  : "border-transparent text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {d.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="lg:flex lg:gap-10">
      {/* Mobile: a bar that opens the drawer */}
      <button
        type="button"
        onClick={() => setDrawer(true)}
        className="mb-5 flex w-full items-center justify-between border border-line px-4 py-3 text-sm text-ink transition-colors hover:border-signal lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SidebarIcon size={15} />
          Documentation
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          {docs.find((d) => d.href === path)?.title ?? "Browse"}
        </span>
      </button>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-50 cursor-default bg-black/60 lg:hidden"
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-line bg-background p-5 lg:hidden"
            >
              <p className="section-rule mb-3">Documentation</p>
              {nav}
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 44 : 224 }}
        transition={{ type: "tween", duration: 0.2, ease: [0.2, 0.8, 0.3, 1] }}
        className="hidden shrink-0 lg:block"
      >
        <div className="sticky top-24">
          <div
            className={`mb-3 flex items-center ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!collapsed && <span className="section-rule">Documentation</span>}
            <button
              type="button"
              onClick={() => writeCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-7 w-7 shrink-0 items-center justify-center border border-line text-faint transition-colors hover:border-signal hover:text-signal"
            >
              <motion.span
                animate={{ rotate: collapsed ? 0 : 180 }}
                transition={{ duration: 0.2 }}
                className="flex"
              >
                <ChevronRightIcon size={13} />
              </motion.span>
            </button>
          </div>

          {/* Kept mounted while collapsed so the width tween has something to
              clip, rather than the list popping in at the end. */}
          <div className={collapsed ? "overflow-hidden opacity-0" : "opacity-100"}>
            {nav}
          </div>
        </div>
      </motion.aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
