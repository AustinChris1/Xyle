"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function CreateMarketForm() {
  const router = useRouter();
  const [headline, setHeadline] = useState("");
  const [player, setPlayer] = useState("operator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/markets/from-headline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, player }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Could not open market");
      router.push(`/markets/${data.market.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open market");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel-hot rounded-xl p-5 sm:p-6">
      <p className="eyebrow">Open a market</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        Paste a headline, get a market
      </h2>
      <p className="mt-2 text-sm text-muted">
        One action that creates permanent recurring miner demand every cron tick.
        Uses a live framing call, then the full oracle stack on readings.
      </p>
      <label className="mt-4 block text-xs text-muted">
        Your handle
        <input
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
          className="input-desk mt-1"
        />
      </label>
      <label className="mt-3 block text-xs text-muted">
        Headline or claim
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={3}
          placeholder="e.g. Ekubo protocol drained in approval-based exploit, Blockaid says"
          className="input-desk mt-1 resize-y font-mono text-sm"
          required
          minLength={12}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <motion.button
          type="submit"
          disabled={busy || headline.trim().length < 12}
          whileTap={{ scale: 0.98 }}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {busy ? "Opening market…" : "Open market"}
        </motion.button>
        {error && <p className="text-sm text-no">{error}</p>}
      </div>
    </form>
  );
}
