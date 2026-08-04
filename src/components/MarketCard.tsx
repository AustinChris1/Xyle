"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Market, OracleTick } from "@/lib/types";
import { ease } from "@/lib/motion";
import { StatusPill } from "./StatusPill";

export function MarketCard({
  market,
  stakes,
  lastTick,
  index = 0,
}: {
  market: Market;
  stakes: number;
  lastTick?: OracleTick | null;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const total = market.potYes + market.potNo;
  const yesPct = total > 0 ? Math.round((market.potYes / total) * 100) : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="h-full"
    >
      <Link
        href={`/markets/${market.id}`}
        className="panel group flex h-full flex-col rounded-xl p-5 transition-colors hover:border-copper/35"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <StatusPill status={market.status} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Bar {(market.confidenceThreshold * 100).toFixed(0)}%
          </span>
        </div>

        <h3 className="text-lg font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-copper-hot">
          {market.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {market.description}
        </p>

        <div className="mt-auto pt-5">
          <div className="mb-1.5 flex justify-between font-mono text-[11px]">
            <span className="text-yes">YES {market.potYes.toFixed(2)}</span>
            <span className="text-no">NO {market.potNo.toFixed(2)}</span>
          </div>
          <div className="meter">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-yes to-copper"
              initial={{ width: 0 }}
              animate={{ width: `${yesPct}%` }}
              transition={{ duration: 0.7, ease, delay: 0.15 + index * 0.05 }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-faint">
            <span>
              {stakes} {stakes === 1 ? "position" : "positions"}
            </span>
            <span aria-hidden="true">/</span>
            <span>{market.eventClass.replace(/_/g, " ")}</span>
            {lastTick && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-copper">
                  Last read {lastTick.verdict} at{" "}
                  {(lastTick.confidence * 100).toFixed(0)}%
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
