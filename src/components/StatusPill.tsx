import type { MarketStatus } from "@/lib/types";

const styles: Record<MarketStatus, string> = {
  open: "border-yes/40 text-yes bg-yes/10",
  settled_yes: "border-copper/50 text-copper-hot bg-copper/10",
  settled_no: "border-no/40 text-no bg-no/10",
  expired: "border-line text-muted bg-sunken",
};

const labels: Record<MarketStatus, string> = {
  open: "Open",
  settled_yes: "Settled Yes",
  settled_no: "Settled No",
  expired: "Expired",
};

export function StatusPill({ status }: { status: MarketStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {status === "open" && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {labels[status]}
    </span>
  );
}
