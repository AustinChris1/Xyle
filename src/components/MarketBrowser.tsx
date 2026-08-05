"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Market, OracleTick } from "@/lib/types";
import { ease } from "@/lib/motion";
import { MarketCard } from "./MarketCard";
import { SearchIcon } from "./Icon";

export interface MarketRow {
  market: Market;
  stakes: number;
  lastTick: OracleTick | null;
}

type StatusFilter = "open" | "settled" | "all";
type Sort = "recent" | "closing" | "activity" | "unread";

const PAGE_SIZE = 8;

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "recent", label: "Newest" },
  { id: "closing", label: "Closing soon" },
  { id: "activity", label: "Most conviction" },
  { id: "unread", label: "Least read" },
];

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "settled", label: "Settled" },
  { id: "all", label: "All" },
];

/**
 * Auto-markets keep opening on every cron cycle, so this list grows without
 * bound. Filter, sort and paginate client-side: the whole set is already in
 * the payload and it is small enough that a round trip per keystroke would be
 * slower than filtering in place.
 */
export function MarketBrowser({ rows }: { rows: MarketRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(0);

  const counts = useMemo(
    () => ({
      open: rows.filter((r) => r.market.status === "open").length,
      settled: rows.filter((r) => r.market.status.startsWith("settled")).length,
      all: rows.length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matches = rows.filter(({ market }) => {
      if (status === "open" && market.status !== "open") return false;
      if (status === "settled" && !market.status.startsWith("settled")) {
        return false;
      }
      if (!q) return true;
      return (
        market.title.toLowerCase().includes(q) ||
        market.description.toLowerCase().includes(q) ||
        market.eventClass.toLowerCase().includes(q)
      );
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (sort) {
        case "closing":
          return (
            new Date(a.market.closesAt).getTime() -
            new Date(b.market.closesAt).getTime()
          );
        case "activity":
          return (
            b.market.potYes +
            b.market.potNo -
            (a.market.potYes + a.market.potNo)
          );
        case "unread": {
          const at = a.market.lastOracleAt
            ? new Date(a.market.lastOracleAt).getTime()
            : 0;
          const bt = b.market.lastOracleAt
            ? new Date(b.market.lastOracleAt).getTime()
            : 0;
          return at - bt;
        }
        default:
          return (
            new Date(b.market.createdAt).getTime() -
            new Date(a.market.createdAt).getTime()
          );
      }
    });
    return sorted;
  }, [rows, query, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-sm">
          <span className="sr-only">Search markets</span>
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="Search markets"
            className="input-desk pl-9"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => reset(setStatus)(f.id)}
                className={`relative rounded-md px-2.5 py-1 text-xs transition-colors ${
                  status === f.id ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {status === f.id && (
                  <motion.span
                    layoutId="market-filter"
                    className="absolute inset-0 -z-10 rounded-md bg-copper/15"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {f.label}
                <span className="ml-1 text-faint">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="market-sort">
            Sort markets
          </label>
          <select
            id="market-sort"
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as Sort)}
            className="input-desk w-auto py-1.5 text-xs"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel rounded-xl px-6 py-14 text-center">
          <p className="text-muted">
            {query
              ? `Nothing matches “${query}”.`
              : "No markets in this view yet."}
          </p>
          {query && (
            <button
              type="button"
              onClick={() => reset(setQuery)("")}
              className="btn-ghost mt-4 text-sm"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${status}-${sort}-${query}-${safePage}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease }}
              className="grid items-stretch gap-4 md:grid-cols-2"
            >
              {visible.map(({ market, stakes, lastTick }, i) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  stakes={stakes}
                  lastTick={lastTick}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between gap-3 pt-1"
              aria-label="Market pages"
            >
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Previous
              </button>

              <p className="font-mono text-[11px] text-muted">
                {safePage * PAGE_SIZE + 1}
                {"–"}
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>

              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
