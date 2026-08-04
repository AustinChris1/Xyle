import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consumption ledger",
  description:
    "Public scoreboard of every paid Telegraph miner call from Signal Arena.",
};

export default async function LedgerPage() {
  const cfg = loadConfig();
  const [entries, byMiner, totalCalls, totalCost] = await Promise.all([
    db.listConsumption(120),
    db.consumptionByMiner(),
    db.minerRequests(),
    db.totalCostUsdc(),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Track 1 demand surface</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Consumption ledger
        </h1>
        <p className="mt-2.5 max-w-2xl text-muted">
          Every miner call this app makes: who, cost, latency, receipt. Track 1
          miners can link here to prove real demand. Network{" "}
          <span className="font-mono text-copper">{cfg.evmNetwork}</span>.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel rounded-xl p-5">
          <div className="font-mono text-[10px] uppercase text-muted">
            Total calls
          </div>
          <div className="mt-1 font-mono text-3xl text-ink">{totalCalls}</div>
        </div>
        <div className="panel rounded-xl p-5">
          <div className="font-mono text-[10px] uppercase text-muted">
            Est. USDC spent
          </div>
          <div className="mt-1 font-mono text-3xl text-copper-hot">
            ${totalCost.toFixed(2)}
          </div>
        </div>
        <div className="panel rounded-xl p-5">
          <div className="font-mono text-[10px] uppercase text-muted">
            Miners hit
          </div>
          <div className="mt-1 font-mono text-3xl text-ink">{byMiner.length}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">By miner</h2>
        <div className="panel mt-3 overflow-x-auto rounded-xl">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Miner ID</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Cost USDC</th>
              </tr>
            </thead>
            <tbody>
              {byMiner.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted">
                    No consumption yet. Run a reading or adversary attempt.
                  </td>
                </tr>
              )}
              {byMiner.map((r) => (
                <tr key={r.minerId} className="border-b border-line/60">
                  <td className="px-4 py-2.5 font-mono">{r.minerId}</td>
                  <td className="px-4 py-2.5 font-mono">{r.calls}</td>
                  <td className="px-4 py-2.5 font-mono text-copper">
                    ${r.costUsdc.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent calls</h2>
        <div className="panel mt-3 overflow-x-auto rounded-xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="px-3 py-3">When</th>
                <th className="px-3 py-3">Miner</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">ms</th>
                <th className="px-3 py-3">USDC</th>
                <th className="px-3 py-3">Context</th>
                <th className="px-3 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line/50">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">
                    {new Date(e.at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono">{e.minerId}</td>
                  <td className="px-3 py-2 text-xs">{e.label}</td>
                  <td className="px-3 py-2 font-mono">{e.latencyMs}</td>
                  <td className="px-3 py-2 font-mono">
                    {e.mocked ? "0" : e.costUsdc.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {e.marketId ? (
                      <Link
                        href={`/markets/${e.marketId}`}
                        className="text-copper hover:underline"
                      >
                        {e.context}
                      </Link>
                    ) : (
                      e.context
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-faint">
                    {e.txHash ? `${e.txHash.slice(0, 14)}…` : e.mocked ? "sim" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
