"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ActionButton";

export function WatchButton({ marketId }: { marketId: string }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const watching = Boolean(user?.watchlistMarketIds?.includes(marketId));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) {
      toast.warn("Connect a wallet and sign in to watch markets.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId }),
      });
      if (!res.ok) throw new Error("Could not update your watchlist");
      await refresh();
      toast.success(
        watching ? "Removed from your watchlist" : "Added to your watchlist"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update watchlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      aria-pressed={watching}
      aria-busy={busy}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
        watching
          ? "border-copper/50 bg-copper/15 text-copper-hot"
          : "border-line text-muted hover:border-copper/40 hover:text-copper"
      }`}
    >
      {busy ? <Spinner size={12} /> : <Star filled={watching} />}
      {watching ? "Watching" : "Watch"}
    </motion.button>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z" />
    </svg>
  );
}
