import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Standings across market positions and adversarial attempts on the oracle.",
};

const columns = [
  { key: "rank", label: "#", align: "text-left" },
  { key: "player", label: "Player", align: "text-left" },
  { key: "correct", label: "Correct", align: "text-right" },
  { key: "accuracy", label: "Accuracy", align: "text-right" },
  { key: "pending", label: "Open", align: "text-right" },
  { key: "best", label: "Best attempt", align: "text-right" },
  { key: "tries", label: "Attempts", align: "text-right" },
  { key: "score", label: "Score", align: "text-right" },
];

export default async function LeaderboardPage() {
  const rows = await db.leaderboard();
  const top = rows[0];

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">Standings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-2.5 max-w-2xl text-muted">
          Ranked by how often your calls turned out right, not by an invented
          balance. One forecast per wallet per market, weighted so a steady
          record beats one lucky call. Adversary attempts count too.
        </p>
      </header>

      {top && (
        <Reveal className="mb-6">
          <div className="panel-hot flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-copper">
                Leading
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {top.player}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Score
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-copper-hot tabular">
                {top.totalScore}
              </p>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.05}>
        <div className="panel overflow-x-auto rounded-xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-faint">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.align}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-16 text-center text-muted"
                  >
                    Nothing here yet. Make a forecast or try an attempt.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={r.player}
                  className="border-b border-line transition-colors last:border-0 hover:bg-copper/5"
                >
                  <td className="px-4 py-3 font-mono text-faint tabular">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{r.player}</td>
                  <td className="px-4 py-3 text-right font-mono tabular">
                    {r.correct}
                    <span className="text-faint">/{r.resolved}</span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular ${
                      r.resolved === 0
                        ? "text-faint"
                        : r.accuracy >= 0.5
                          ? "text-yes"
                          : "text-no"
                    }`}
                  >
                    {r.resolved === 0
                      ? "not yet"
                      : `${(r.accuracy * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted tabular">
                    {r.pending}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-copper-hot tabular">
                    {(r.challengeBest * 100).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted tabular">
                    {r.challengeCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-copper tabular">
                    {r.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
}
