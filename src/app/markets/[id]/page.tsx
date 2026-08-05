import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icon";
import { notFound } from "next/navigation";
import { MarketDetailClient } from "@/components/MarketDetailClient";
import { loadConfig } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const market = await db.getMarket(id);
  if (!market) return { title: "Market not found" };
  return { title: market.title, description: market.description };
}

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = await db.getMarket(id);
  if (!market) notFound();
  const cfg = loadConfig();

  return (
    <div className="space-y-6">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-copper"
      >
        <ArrowLeftIcon size={13} /> All markets
      </Link>
      <MarketDetailClient
        initialMarket={market}
        initialStakes={await db.listStakes(id)}
        initialTicks={await db.listTicks(id)}
        network={cfg.evmNetwork}
        lastCronAt={await db.lastCronAt()}
        intervalMinutes={cfg.oracleIntervalMinutes}
      />
    </div>
  );
}
