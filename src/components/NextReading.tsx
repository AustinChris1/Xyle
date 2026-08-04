"use client";

import { useEffect, useState } from "react";

/** Client countdown to next scheduled reading window. */
export function NextReading({
  lastOracleAt,
  lastCronAt,
  intervalMinutes = 15,
}: {
  lastOracleAt?: string;
  lastCronAt?: string | null;
  intervalMinutes?: number;
}) {
  const anchor = lastOracleAt || lastCronAt || null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = intervalMinutes * 60 * 1000;
  const base = anchor ? new Date(anchor).getTime() : now;
  let next = base + ms;
  while (next <= now) next += ms;
  const remaining = Math.max(0, next - now);
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
      Next reading in{" "}
      <span className="text-copper-hot tabular">
        {m}:{s.toString().padStart(2, "0")}
      </span>
      <span className="text-faint"> · every {intervalMinutes}m</span>
    </div>
  );
}
