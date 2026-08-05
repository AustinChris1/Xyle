import Link from "next/link";
import { db } from "@/lib/db";
import { Hero } from "@/components/landing/Hero";
import { SettlementDemo } from "@/components/landing/SettlementDemo";
import { ScrollPipeline } from "@/components/landing/ScrollPipeline";
import { AdversaryTeaser } from "@/components/landing/AdversaryTeaser";
import { MinerConstellation } from "@/components/landing/MinerConstellation";
import { Reveal } from "@/components/Reveal";
import { SignalMark } from "@/components/brand/SignalMark";
import { StatusPill } from "@/components/StatusPill";
import { ActivityFeed } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

const claims = [
  {
    tint: "var(--evidence)",
    title: "Infrastructure, not just a demo",
    body: "POST /api/oracle/verify is a public endpoint. Other apps can buy a four-miner verdict with receipts.",
  },
  {
    tint: "var(--authenticity)",
    title: "Four different miners",
    body: "Evidence (Tavily 202), authenticity (DeepSeek 115), judge A (OpenRouter 110), judge B (LiteLLM 104). YES needs dual consensus.",
  },
  {
    tint: "var(--judgment)",
    title: "Demand is public",
    body: "The consumption ledger is a scoreboard Track 1 miners can link to: every call, cost, latency, receipt.",
  },
];

export default async function HomePage() {
  const markets = await db.listMarkets();
  const open = markets.filter((m) => m.status === "open");
  const preview = (open.length > 0 ? open : markets).slice(0, 3);
  const activity = await db.listActivity(12);
  const minerCalls = await db.minerRequests();
  const cost = await db.totalCostUsdc();

  return (
    <>
      <Hero />

      <section className="mt-16 sm:mt-24">
        <Reveal className="mb-6">
          <p className="eyebrow">Watch one resolve</p>
          <h2 className="mt-2.5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            A claim goes in. Four miners weigh it. The pot pays the skeptics.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <SettlementDemo />
        </Reveal>
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal className="mb-10">
          <p className="eyebrow">How settlement works</p>
          <h2 className="mt-2.5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            One reading, four independent miners
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            A verdict only lands when both judges agree and the evidence
            survives the authenticity check. Any stage can hold the market open
            on its own.
          </p>
        </Reveal>
        <ScrollPipeline />
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal>
          <div className="glass rounded-2xl px-5 py-8 sm:px-10 sm:py-10">
            <p className="eyebrow">The stack</p>
            <h2 className="mt-2.5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Four miners argue. One verdict comes out, with receipts.
            </h2>
            {/* The diagram's labels stop being legible below ~560px, so on
                small screens it scrolls sideways instead of shrinking. */}
            <div className="mt-8 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <div className="min-w-140">
                <MinerConstellation />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mt-16 grid gap-4 sm:mt-24 sm:grid-cols-3">
        {claims.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.08}>
            <div
              className="tinted h-full rounded-2xl p-6"
              style={{ ["--tint" as string]: c.tint }}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[11px] font-semibold"
                style={{
                  color: c.tint,
                  background: `color-mix(in srgb, ${c.tint} 16%, transparent)`,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3.5 font-semibold tracking-tight text-ink">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {c.body}
              </p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Live tape</p>
            <h2 className="mt-2.5 text-2xl font-semibold tracking-tight">
              What the desk did without you
            </h2>
            <p className="mt-2 font-mono text-xs text-muted">
              {minerCalls} miner calls · ~${cost.toFixed(2)} USDC ·{" "}
              <Link href="/ledger" className="text-copper hover:underline">
                full ledger
              </Link>
            </p>
          </div>
          <Link
            href="/api/oracle/verify"
            className="font-mono text-[11px] uppercase tracking-wider text-copper hover:text-copper-hot"
          >
            GET verify docs
          </Link>
        </Reveal>
        <Reveal delay={0.06}>
          <ActivityFeed items={activity} />
        </Reveal>
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal>
          <AdversaryTeaser />
        </Reveal>
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">On the board now</p>
              <h2 className="mt-2.5 text-2xl font-semibold tracking-tight">
                Open markets
              </h2>
            </div>
            <Link
              href="/markets"
              className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-copper transition-colors hover:text-copper-hot"
            >
              See all
            </Link>
          </div>
        </Reveal>

        <div className="space-y-2">
          {preview.length === 0 && (
            <p className="panel rounded-lg px-4 py-8 text-center text-sm text-muted">
              No markets on the board yet.
            </p>
          )}
          {preview.map((m, i) => (
            <Reveal key={m.id} delay={i * 0.06}>
              <Link
                href={`/markets/${m.id}`}
                className="panel group flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-4 transition-colors hover:border-copper/35"
              >
                <span className="text-sm text-ink transition-colors group-hover:text-copper-hot">
                  {m.title}
                </span>
                <StatusPill status={m.status} />
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mt-16 sm:mt-24">
        <Reveal>
          <div className="panel relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-10">
            <div className="relative flex flex-col items-center">
              <span className="text-copper">
                <SignalMark size={52} idle />
              </span>
              <h2 className="mt-6 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
                Paste a headline. Let four miners argue. Settle on consensus.
              </h2>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/markets" className="btn-primary text-sm">
                  Open a market
                </Link>
                <Link href="/ledger" className="btn-ghost text-sm">
                  Consumption ledger
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
