import type { Metadata } from "next";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";
import { fetchCatalog } from "@/lib/telegraph/catalog";
import { PulseTable } from "@/components/PulseTable";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pulse",
  description:
    "Live health for every miner in the Telegraph catalog: routability, paid liveness, latency, and embeddable status badges.",
};

export default async function PulsePage() {
  const cfg = loadConfig();
  const catalog = await fetchCatalog();
  const health = await db.minerHealth(catalog);

  const ranked = health.slice().sort((a, b) => {
    const rank = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
    const d = rank[a.state] - rank[b.state];
    return d !== 0 ? d : Number(a.minerId) - Number(b.minerId);
  });

  const counts = health.reduce(
    (acc, h) => {
      acc[h.state] = (acc[h.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const tested = health.filter((h) => h.liveProbes > 0);
  const appUrl = cfg.appUrl.replace(/\/$/, "");

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Ecosystem status</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pulse
        </h1>
        <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
          Health for every miner in the Telegraph catalog. We pay these miners
          for real work, so this is measured, not advertised. Two signals:
          whether the node still routes to a miner, and whether the service
          behind it actually answers when paid.
        </p>
      </header>

      <Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "In catalog", v: catalog.length, c: "text-ink" },
            { k: "Healthy", v: counts.healthy ?? 0, c: "text-yes" },
            {
              k: "Degraded or down",
              v: (counts.degraded ?? 0) + (counts.down ?? 0),
              c: "text-no",
            },
            { k: "Proven by payment", v: tested.length, c: "text-copper" },
          ].map((cell) => (
            <div key={cell.k} className="panel rounded-xl p-4">
              <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
                {cell.k}
              </div>
              <div className={`mt-1 font-mono text-2xl ${cell.c} tabular`}>
                {cell.v}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="panel rounded-xl p-5">
          <h2 className="eyebrow">How to read this</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-ink">Routable</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">
                A free check. The node answers <code>402 Payment Required</code>,
                so dispatch works. Cheap, but it does not prove the upstream is
                alive.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Live</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">
                A paid call that actually returned. This is the one that counts.
                Miner 109 stayed routable for weeks while its upstream quota was
                exhausted.
              </dd>
            </div>
          </dl>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <PulseTable miners={ranked} appUrl={appUrl} />
      </Reveal>

      <Reveal delay={0.15}>
        <section className="panel rounded-xl p-5">
          <h2 className="eyebrow">Embed your badge</h2>
          <p className="mt-2 text-sm text-muted">
            Miner operators: drop this in your README and it stays current.
          </p>
          <div className="sunken mt-3 overflow-x-auto rounded-lg p-3">
            <pre className="font-mono text-[11px] text-muted">
{`![Telegraph miner 202](${appUrl}/badge/202.svg)`}
            </pre>
          </div>
          <p className="mt-3 text-xs text-faint">
            Machine-readable feed: <code>GET /api/pulse</code>
          </p>
        </section>
      </Reveal>
    </div>
  );
}
