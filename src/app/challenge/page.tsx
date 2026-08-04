import type { Metadata } from "next";
import { ChallengeClient } from "@/components/ChallengeClient";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Adversary",
  description:
    "Write a claim convincing enough to push the settlement oracle toward a false YES. Hall of breaks is public red-team data.",
};

export default async function ChallengePage() {
  const attempts = (await db.listChallenges()).slice(0, 50);
  const breaks = await db.hallOfBreaks(15);
  return (
    <div className="space-y-10">
      <ChallengeClient initial={attempts} network={loadConfig().evmNetwork} />
      <section>
        <p className="eyebrow">Hall of breaks</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          Claims that beat the oracle
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Public red-team set: dual-judge YES with confidence over the bar.
          Useful regression cases for evidence oracles beyond this hackathon.
        </p>
        {breaks.length === 0 ? (
          <div className="panel mt-4 rounded-xl px-5 py-8 text-center text-sm text-muted">
            No breaks yet. That means the desk is holding.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {breaks.map((b) => (
              <li key={b.id} className="panel rounded-lg px-4 py-3 text-sm">
                <div className="flex justify-between gap-2 font-mono text-xs">
                  <span className="text-copper-hot">
                    {(b.foolScore * 100).toFixed(1)}
                  </span>
                  <span className="text-faint">{b.player}</span>
                </div>
                <p className="mt-1 text-muted">{b.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
