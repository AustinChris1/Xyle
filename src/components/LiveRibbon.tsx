"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "./CountUp";

interface Stats {
  mockMode: boolean;
  hasEvmKey: boolean;
  minerRequests: number;
  marketsOpen: number;
  marketsSettled: number;
  paymentNetwork: string;
  nodeOk: boolean;
  integrations: number;
}

const NETWORK_NAMES: Record<string, string> = {
  "eip155:84532": "Base Sepolia",
  "eip155:8453": "Base",
};

function networkName(id: string) {
  return NETWORK_NAMES[id] ?? id;
}

export function LiveRibbon() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setStats(d);
        })
        .catch(() => {});
    load();
    // 30s, and only while the tab is visible. A 15s poll from a tab left open
    // overnight burns a meaningful slice of the Vercel Hobby invocation quota.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const online = Boolean(stats && stats.nodeOk && !stats.mockMode && stats.hasEvmKey);
  const simulated = Boolean(stats?.mockMode);

  const label = !stats
    ? "Connecting"
    : online
      ? "Oracle live"
      : simulated
        ? "Simulation mode"
        : "Oracle standby";

  const tone = !stats
    ? "text-muted"
    : online
      ? "text-yes"
      : simulated
        ? "text-warn"
        : "text-no";

  return (
    <div className="border-b border-line bg-sunken">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className={`inline-flex items-center gap-1.5 font-semibold ${tone}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${
                online ? "live-dot" : ""
              }`}
            />
            {label}
          </motion.span>
        </AnimatePresence>

        {/* Only the demand number earns a permanent slot. Market counts live
            on /markets and the network on /ledger, so they stay in the title. */}
        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-x-5"
            title={`${stats.marketsOpen} open, ${stats.marketsSettled} settled, paid on ${networkName(stats.paymentNetwork)}`}
          >
            <span className="text-copper">
              <CountUp value={stats.minerRequests} /> paid miner calls
            </span>
            <span className="hidden sm:inline">
              <CountUp value={stats.integrations} /> miners live
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
