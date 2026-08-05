"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { useToast } from "@/components/Toast";
import { PlusIcon } from "@/components/Icon";

export function CreateMarketForm() {
  const router = useRouter();
  const toast = useToast();
  const [headline, setHeadline] = useState("");
  const [player, setPlayer] = useState("operator");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/markets/from-headline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, player }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? data.error ?? "Could not open market");
      toast.success("Market opened. Taking you to it.");
      router.push(`/markets/${data.market.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not open that market"
      );
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
        <ActionButton
          type="submit"
          pending={busy}
          pendingLabel="Opening market"
          disabled={headline.trim().length < 12}
          className="w-full text-sm sm:w-auto"
        >
          <PlusIcon size={14} />
          Open market
        </ActionButton>
        <p className="text-xs text-faint">Costs one paid framing call.</p>
      </div>
    </form>
  );
}
