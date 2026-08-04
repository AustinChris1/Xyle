import Link from "next/link";
import type { ActivityItem } from "@/lib/types";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="panel rounded-xl px-5 py-10 text-center text-sm text-muted">
        No activity yet. Open a market, run a reading, or attack the oracle.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href={a.href || "#"}
            className="panel flex flex-wrap items-start justify-between gap-2 rounded-lg px-4 py-3 transition hover:border-copper/30"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-copper">
                {a.kind.replace(/_/g, " ")}
              </div>
              <div className="mt-0.5 text-sm text-ink">{a.title}</div>
              {a.detail && (
                <div className="mt-0.5 text-xs text-muted">{a.detail}</div>
              )}
            </div>
            <time className="font-mono text-[10px] text-faint">
              {new Date(a.at).toLocaleString()}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
