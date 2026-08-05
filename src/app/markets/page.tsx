import type { Metadata } from "next";
import { MarketBrowser } from "@/components/MarketBrowser";
import { CreateMarketForm } from "@/components/CreateMarketForm";
import { NextReading } from "@/components/NextReading";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Evidence-settled markets. Paste a headline to open one. Cron keeps readings running.",
};

export default async function MarketsPage() {
  const cfg = loadConfig();
  const lastCronAt = await db.lastCronAt();
  const markets = await db.listMarkets();
  const cards = await Promise.all(
    markets.map(async (m) => ({
      market: m,
      stakes: (await db.listStakes(m.id)).length,
      lastTick: (await db.listTicks(m.id))[0] ?? null,
    }))
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The board</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Open markets
          </h1>
          <p className="mt-2.5 max-w-2xl text-muted">
            Call YES or NO, one per wallet. Readings fuse four miners.
            Settlement needs dual-judge consensus above the confidence bar,
            and your accuracy is what scores.
          </p>
        </div>
        <NextReading
          lastCronAt={lastCronAt}
          intervalMinutes={cfg.oracleIntervalMinutes}
        />
      </header>

      <CreateMarketForm />

      {cards.length === 0 ? (
        <div className="panel rounded-xl px-6 py-16 text-center">
          <p className="text-muted">No markets yet. Paste a headline above.</p>
        </div>
      ) : (
        <MarketBrowser rows={cards} />
      )}
    </div>
  );
}
