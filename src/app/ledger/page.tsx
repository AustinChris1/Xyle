import type { Metadata } from "next";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";
import { LedgerTable } from "@/components/LedgerTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consumption ledger",
  description:
    "Public scoreboard of every paid Telegraph miner call from Xyle.",
};

export default async function LedgerPage() {
  const cfg = loadConfig();
  const [entries, byMiner, totalCalls, totalCost] = await Promise.all([
    db.listConsumption(500),
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
        <p className="mt-1 mb-3 text-sm text-muted">
          Every paid miner call, including the ones that failed. Failures cost
          nothing and are kept as reliability data.
        </p>
        <LedgerTable entries={entries} network={cfg.evmNetwork} />
      </section>

    </div>
  );
}
