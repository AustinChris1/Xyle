import Link from "next/link";
import { XyleMark } from "./brand/XyleMark";

/**
 * Also the site's crawlable index.
 *
 * The nav keeps most destinations behind dropdowns that only exist in the DOM
 * once opened, so without this the deeper pages would have no plain link on
 * most routes.
 */
const columns = [
  {
    label: "Verify",
    links: [
      { href: "/verify", label: "Check a claim" },
      { href: "/markets", label: "Markets" },
      { href: "/docs/usage", label: "How to use it" },
    ],
  },
  {
    label: "Evidence",
    links: [
      { href: "/pulse", label: "Miner health" },
      { href: "/calibration", label: "Calibration" },
      { href: "/ledger", label: "Spend ledger" },
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/challenge", label: "Break it" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/desk", label: "Your desk" },
    ],
  },
  {
    label: "Docs",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/how-it-works", label: "How it works" },
      { href: "/docs/architecture", label: "Architecture" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 text-signal">
              <XyleMark size={22} />
              <span className="text-sm font-semibold tracking-tight text-ink">
                Xyle
              </span>
            </div>
            <p className="mt-3 max-w-[22ch] text-xs leading-relaxed text-faint">
              Verified answers, with receipts. Settled by live Telegraph miners,
              paid per call with x402.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.label}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                {col.label}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-muted transition-colors hover:text-signal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>Base Sepolia testnet · no real money</span>
          <a
            href="https://hackathon.telegraphprotocol.com"
            className="transition-colors hover:text-signal"
            target="_blank"
            rel="noreferrer"
          >
            Telegraph Hackathon ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
