"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ConsumptionEntry } from "@/lib/types";
import { ease } from "@/lib/motion";
import { txUrl } from "@/lib/explorer";
import { SearchIcon } from "./Icon";

type Outcome = "all" | "ok" | "failed";

const PAGE_SIZE = 25;

/**
 * The ledger is the demand scoreboard, so it has to stay readable as call
 * volume grows. Filtering runs client-side over the payload the page already
 * fetched; at a few hundred rows that beats a round trip per keystroke.
 */
export function LedgerTable({
  entries,
  network,
}: {
  entries: ConsumptionEntry[];
  network: string;
}) {
  const [query, setQuery] = useState("");
  const [miner, setMiner] = useState("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [page, setPage] = useState(0);

  // Miner options carry their own call counts, which doubles as a
  // reliability summary without another table.
  const miners = useMemo(() => {
    const map = new Map<string, { id: string; label: string; calls: number }>();
    for (const e of entries) {
      const cur = map.get(e.minerId) ?? {
        id: e.minerId,
        label: e.label.replace(/\s+\d+.*/, "").trim() || e.minerId,
        calls: 0,
      };
      cur.calls += 1;
      map.set(e.minerId, cur);
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (miner !== "all" && e.minerId !== miner) return false;
      if (outcome === "ok" && !e.success) return false;
      if (outcome === "failed" && e.success) return false;
      if (!q) return true;
      return (
        e.minerId.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        String(e.role).toLowerCase().includes(q) ||
        e.context.toLowerCase().includes(q) ||
        (e.txHash?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, query, miner, outcome]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const shownCost = filtered.reduce((sum, e) => sum + e.costUsdc, 0);
  const failures = filtered.filter((e) => !e.success).length;

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-xs">
          <span className="sr-only">Search calls</span>
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => change(setQuery)(e.target.value)}
            placeholder="Miner, role, context, receipt"
            className="input-desk pl-9 text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ledger-miner">
            Filter by miner
          </label>
          <select
            id="ledger-miner"
            value={miner}
            onChange={(e) => change(setMiner)(e.target.value)}
            className="input-desk w-auto py-1.5 text-xs"
          >
            <option value="all">All miners ({entries.length})</option>
            {miners.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} {m.id} ({m.calls})
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-line p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "ok", label: "Paid" },
                { id: "failed", label: "Failed" },
              ] as Array<{ id: Outcome; label: string }>
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => change(setOutcome)(o.id)}
                className={`relative rounded-md px-2.5 py-1 text-xs transition-colors ${
                  outcome === o.id ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {outcome === o.id && (
                  <motion.span
                    layoutId="ledger-outcome"
                    className="absolute inset-0 -z-10 rounded-md bg-copper/15"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="font-mono text-[11px] text-faint">
        {filtered.length} of {entries.length} calls
        {" · "}
        <span className="text-copper">${shownCost.toFixed(2)} USDC</span>
        {failures > 0 && (
          <>
            {" · "}
            <span className="text-no">{failures} failed</span>
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="panel rounded-xl px-6 py-12 text-center text-sm text-muted">
          No calls match that filter.
        </div>
      ) : (
        <>
          <div className="panel overflow-x-auto rounded-xl">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line font-mono text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Miner</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3 text-right">ms</th>
                  <th className="px-3 py-3 text-right">USDC</th>
                  <th className="px-3 py-3">Context</th>
                  <th className="px-3 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {visible.map((e) => {
                    const link = e.txHash ? txUrl(network, e.txHash) : undefined;
                    return (
                      <motion.tr
                        key={e.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, ease }}
                        className={`border-b border-line/50 ${
                          e.success ? "" : "bg-no/5"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-muted">
                          {new Date(e.at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono">{e.minerId}</td>
                        <td className="px-3 py-2 text-xs">
                          {e.label}
                          {!e.success && (
                            <span className="ml-1.5 rounded border border-no/40 px-1 py-0.5 font-mono text-[9px] uppercase text-no">
                              failed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular">
                          {e.latencyMs}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular">
                          {e.mocked ? "0" : e.costUsdc.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">
                          {e.marketId ? (
                            <Link
                              href={`/markets/${e.marketId}`}
                              className="text-copper hover:underline"
                            >
                              {e.context}
                            </Link>
                          ) : (
                            e.context
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-faint">
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-copper hover:underline"
                            >
                              {e.txHash!.slice(0, 12)}…
                            </a>
                          ) : e.mocked ? (
                            "sim"
                          ) : (
                            "—"
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between gap-3"
              aria-label="Ledger pages"
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
