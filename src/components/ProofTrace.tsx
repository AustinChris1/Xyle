"use client";

import { motion } from "framer-motion";
import type { PaymentProof } from "@/lib/types";
import { listItem, stagger } from "@/lib/motion";
import { txUrl } from "@/lib/explorer";

const ROLE_LABELS: Record<string, string> = {
  news: "Evidence",
  authenticity: "Authenticity",
  reason: "Judgment",
};

function roleOf(proof: PaymentProof) {
  const key = proof.role ?? proof.subnet;
  return ROLE_LABELS[key] ?? "Stage";
}

/** Per-stage receipt for a single oracle reading. */
export function ProofTrace({
  proofs,
  network,
}: {
  proofs: PaymentProof[];
  network: string;
}) {
  if (proofs.length === 0) return null;

  return (
    <motion.ol
      variants={stagger(0.05, 0.08)}
      initial="hidden"
      animate="show"
      className="space-y-1.5"
    >
      {proofs.map((p, i) => {
        const link = p.txHash ? txUrl(network, p.txHash) : undefined;
        return (
          <motion.li
            key={`${p.label ?? p.subnet}-${i}`}
            variants={listItem}
            className="sunken flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 font-mono text-[11px]"
          >
            <span className="font-semibold text-ink">{roleOf(p)}</span>
            {p.minerId && <span className="text-faint">miner {p.minerId}</span>}
            <span
              className={p.mocked ? "text-warn" : "text-yes"}
              title={p.mocked ? "Simulated response" : "Paid miner call"}
            >
              {p.mocked ? "simulated" : "paid"}
            </span>
            <span className="text-muted tabular">{p.latencyMs} ms</span>
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-copper underline-offset-2 hover:underline"
              >
                receipt {p.txHash!.slice(0, 10)}
              </a>
            ) : (
              p.txHash && (
                <span className="ml-auto text-faint">
                  receipt {p.txHash.slice(0, 10)}
                </span>
              )
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
