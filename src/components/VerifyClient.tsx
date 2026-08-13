"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ease } from "@/lib/motion";
import { ActionButton } from "./ActionButton";
import { useToast } from "./Toast";
import { SearchIcon } from "./Icon";

const EXAMPLES = [
  "A major DeFi protocol was exploited for more than $10 million this week",
  "A major airline cancelled hundreds of flights in the last 48 hours",
  "A central bank cut interest rates in the past week",
];

const MIN = 20;

/**
 * The human front door to POST /api/oracle/verify. Redirects to the permalink
 * so the result is a page, not a transient blob of JSON.
 */
export function VerifyClient() {
  const router = useRouter();
  const toast = useToast();
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);

  const tooShort = claim.trim().length < MIN;

  async function submit() {
    if (tooShort) return;
    setBusy(true);
    setStage(0);

    // The pipeline is ~40s of silence otherwise, so narrate it.
    const timers = [
      window.setTimeout(() => setStage(1), 6000),
      window.setTimeout(() => setStage(2), 16000),
      window.setTimeout(() => setStage(3), 26000),
    ];

    try {
      const res = await fetch("/api/oracle/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: claim.trim() }),
      });
      const data = await res.json();

      if (res.status === 429) {
        toast.warn(data.detail ?? "Rate limited. Try again shortly.");
        return;
      }
      if (!res.ok || !data.id) {
        throw new Error(data.detail ?? data.error ?? "Verification failed");
      }

      toast.success("Verified. Opening the receipt.");
      router.push(`/c/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      timers.forEach(window.clearTimeout);
      setBusy(false);
      setStage(0);
    }
  }

  const STAGES = [
    "Searching for evidence",
    "Scoring the coverage for authenticity",
    "Asking judge A",
    "Asking judge B",
  ];

  return (
    <div className="space-y-4">
      <div className="panel-hot rounded-2xl p-6 sm:p-8">
        <label className="block">
          <span className="flex items-baseline justify-between">
            <span className="eyebrow">Claim to check</span>
            <span
              className={`font-mono text-[10px] tabular ${
                tooShort ? "text-faint" : "text-yes"
              }`}
            >
              {claim.trim().length} / {MIN} min
            </span>
          </span>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            rows={4}
            disabled={busy}
            placeholder="Something that either happened or did not, recently."
            className="input-desk mt-2 resize-y leading-relaxed"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ActionButton
            pending={busy}
            pendingLabel="Checking"
            disabled={tooShort}
            onClick={() => void submit()}
            className="w-full text-sm sm:w-auto"
          >
            <SearchIcon size={14} />
            Verify this claim
          </ActionButton>
          <p className="text-xs text-faint">
            Four paid miner calls, about 40 seconds, roughly $0.04.
          </p>
        </div>

        <AnimatePresence>
          {busy && (
            <motion.ol
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 space-y-1.5 overflow-hidden"
            >
              {STAGES.map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 font-mono text-[11px] transition-colors ${
                    i < stage
                      ? "text-yes"
                      : i === stage
                        ? "text-copper-hot"
                        : "text-faint"
                  }`}
                >
                  <motion.span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                    animate={
                      i === stage ? { opacity: [1, 0.3, 1] } : { opacity: 1 }
                    }
                    transition={{ repeat: i === stage ? Infinity : 0, duration: 1 }}
                  />
                  {label}
                  {i < stage && " ✓"}
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>

      {!busy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease }}
          className="flex flex-wrap gap-2"
        >
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setClaim(e)}
              className="panel rounded-full px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-copper/40 hover:text-ink"
            >
              {e}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
