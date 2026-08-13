"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { MinerHealth } from "@/lib/types";
import { SearchIcon } from "./Icon";
import { useToast } from "./Toast";

type StateFilter = "all" | "healthy" | "degraded" | "down" | "unknown";

const STATE_TONE: Record<string, string> = {
  healthy: "text-yes",
  degraded: "text-warn",
  down: "text-no",
  unknown: "text-faint",
};

const STATE_DOT: Record<string, string> = {
  healthy: "bg-yes",
  degraded: "bg-warn",
  down: "bg-no",
  unknown: "bg-faint",
};

const STATE_LABEL: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unproven",
};

function ago(iso?: string) {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return "never";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PulseTable({
  miners,
  appUrl,
}: {
  miners: MinerHealth[];
  appUrl: string;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<StateFilter>("all");

  const counts = useMemo(
    () =>
      miners.reduce(
        (acc, m) => {
          acc.all += 1;
          acc[m.state] += 1;
          return acc;
        },
        { all: 0, healthy: 0, degraded: 0, down: 0, unknown: 0 }
      ),
    [miners]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return miners.filter((m) => {
      if (state !== "all" && m.state !== state) return false;
      if (!q) return true;
      return (
        m.minerId.includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q)
      );
    });
  }, [miners, query, state]);

  async function copyBadge(minerId: string) {
    const md = `![Telegraph miner ${minerId}](${appUrl}/badge/${minerId}.svg)`;
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Badge markdown copied. Paste it into your README.");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-xs">
          <span className="sr-only">Search miners</span>
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Miner id or name"
            className="input-desk pl-9 text-sm"
          />
        </label>

        <div className="flex flex-wrap rounded-lg border border-line p-0.5">
          {(
            ["all", "healthy", "degraded", "down", "unknown"] as StateFilter[]
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              className={`relative rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                state === s ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {state === s && (
                <motion.span
                  layoutId="pulse-filter"
                  className="absolute inset-0 -z-10 rounded-md bg-copper/15"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {s === "unknown" ? "unproven" : s}
              <span className="ml-1 text-faint">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel rounded-xl px-6 py-12 text-center text-sm text-muted">
          No miners match that filter.
        </div>
      ) : (
        <div className="panel overflow-x-auto rounded-xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-faint">
              <tr>
                <th className="px-3 py-3">Miner</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3 text-right">Live</th>
                <th className="px-3 py-3 text-right">Routable</th>
                <th className="px-3 py-3 text-right">p50</th>
                <th className="px-3 py-3">Last ok</th>
                <th className="px-3 py-3">Badge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.minerId}
                  className="border-b border-line/50 last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-faint">
                        {m.minerId}
                      </span>
                      <span className="text-ink">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono text-xs ${STATE_TONE[m.state]}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${STATE_DOT[m.state]}`}
                      />
                      {STATE_LABEL[m.state]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular">
                    {m.liveProbes > 0 ? (
                      <>
                        {(m.liveUptime * 100).toFixed(0)}%
                        <span className="text-faint"> /{m.liveProbes}</span>
                      </>
                    ) : (
                      <span className="text-faint">not tested</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular text-muted">
                    {m.routableProbes > 0
                      ? `${(m.routableUptime * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular text-muted">
                    {m.p50LatencyMs ? `${m.p50LatencyMs}ms` : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted">
                    {ago(m.lastOk)}
                    {m.state === "down" && m.lastError && (
                      <div className="mt-0.5 line-clamp-1 text-[10px] text-no">
                        {m.lastError}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void copyBadge(m.minerId)}
                      className="rounded border border-line px-2 py-1 font-mono text-[10px] text-muted transition-colors hover:border-copper/40 hover:text-copper-hot"
                    >
                      copy md
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
