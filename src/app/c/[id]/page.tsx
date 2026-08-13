import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";
import { ProofTrace } from "@/components/ProofTrace";
import { Reveal } from "@/components/Reveal";
import { ArrowLeftIcon, ExternalIcon } from "@/components/Icon";
import { ClaimShare } from "@/components/ClaimShare";

export const dynamic = "force-dynamic";

const VERDICT_TONE: Record<string, string> = {
  yes: "text-yes",
  no: "text-no",
  uncertain: "text-warn",
};

const VERDICT_WORD: Record<string, string> = {
  yes: "Supported",
  no: "Not supported",
  uncertain: "Not established",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const claim = await db.getClaim(id);
  if (!claim) return { title: "Claim not found" };

  const title = `${VERDICT_WORD[claim.verdict]} · ${(claim.confidence * 100).toFixed(0)}% confidence`;
  return {
    title,
    description: claim.claim.slice(0, 180),
    openGraph: {
      title,
      description: claim.claim.slice(0, 180),
      type: "article",
    },
  };
}

function age(iso?: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claim = await db.getClaim(id);
  if (!claim) notFound();

  const cfg = loadConfig();
  const paid = claim.proofs.filter((p) => !p.mocked).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-copper"
      >
        <ArrowLeftIcon size={13} /> Xyle
      </Link>

      <Reveal>
        <article className="panel rounded-2xl p-6 sm:p-8">
          <p className="eyebrow">Verified claim</p>

          <blockquote className="mt-3 border-l-2 border-copper/40 pl-4 text-lg leading-relaxed text-ink sm:text-xl">
            {claim.claim}
          </blockquote>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span
              className={`font-mono text-3xl font-semibold ${VERDICT_TONE[claim.verdict] ?? "text-ink"}`}
            >
              {VERDICT_WORD[claim.verdict] ?? claim.verdict}
            </span>
            <span className="font-mono text-lg text-muted tabular">
              {(claim.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>

          <div className="meter mt-4">
            <div
              className={`h-full ${claim.verdict === "yes" ? "bg-yes" : claim.verdict === "no" ? "bg-no" : "bg-warn"}`}
              style={{ width: `${Math.max(2, claim.confidence * 100)}%` }}
            />
          </div>

          <p className="mt-5 leading-relaxed text-muted">{claim.reasoning}</p>

          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                k: "Judge A",
                v: claim.consensus.judgeA,
                c: VERDICT_TONE[claim.consensus.judgeA],
              },
              {
                k: "Judge B",
                v: claim.consensus.judgeB,
                c: VERDICT_TONE[claim.consensus.judgeB],
              },
              {
                k: "Agreed",
                v: claim.consensus.agreed ? "yes" : "no",
                c: claim.consensus.agreed ? "text-yes" : "text-warn",
              },
              {
                k: "Authenticity",
                v: claim.authenticity.aiLikely ? "synthetic" : "human",
                c: claim.authenticity.aiLikely ? "text-warn" : "text-yes",
              },
            ].map((cell) => (
              <div key={cell.k} className="sunken rounded-lg p-3">
                <dt className="font-mono text-[10px] uppercase tracking-wide text-faint">
                  {cell.k}
                </dt>
                <dd className={`mt-1 font-mono text-sm ${cell.c ?? "text-ink"}`}>
                  {cell.v}
                </dd>
              </div>
            ))}
          </dl>

          {/* Optional chained: claims are stored as JSON and outlive schema
              changes, so a row written by an older build may not carry every
              field this page expects. A missing one should hide a note, not
              500 the whole verdict. */}
          {claim.stages?.degraded?.length ? (
            <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 font-mono text-[11px] text-warn">
              Ran on {claim.stages.completed} of {claim.stages.total} stages.
              Unavailable: {claim.stages.degraded.join(", ")}.
            </p>
          ) : null}

          <p className="mt-6 font-mono text-[11px] text-faint">
            {new Date(claim.at).toLocaleString()} · {paid} paid miner calls · $
            {claim.costUsdc.toFixed(2)} USDC
            {claim.requestedByHandle ? ` · asked by ${claim.requestedByHandle}` : ""}
          </p>

          <ClaimShare claimId={claim.id} verdict={claim.verdict} />
        </article>
      </Reveal>

      {claim.sources.length > 0 && (
        <Reveal delay={0.05}>
          <section className="panel rounded-2xl p-6">
            <h2 className="eyebrow">Evidence on the record</h2>
            <ul className="mt-4 space-y-2">
              {claim.sources.map((s, i) => (
                <li key={i} className="sunken rounded-lg px-3 py-2.5 text-sm">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-ink underline-offset-2 hover:text-copper-hot hover:underline"
                    >
                      {s.title}
                      <ExternalIcon size={11} />
                    </a>
                  ) : (
                    <div className="font-medium text-ink">{s.title}</div>
                  )}
                  {s.publishedAt && (
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-faint">
                      {new Date(s.publishedAt).toLocaleDateString()} ·{" "}
                      {age(s.publishedAt)}
                    </div>
                  )}
                  <p className="mt-1 leading-relaxed text-muted">{s.snippet}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <section className="panel rounded-2xl p-6">
          <h2 className="eyebrow">What this verdict cost</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Each stage is a metered call to a different Telegraph miner, paid on
            chain. Anyone can replay the receipts.
          </p>
          <ProofTrace proofs={claim.proofs} network={cfg.evmNetwork} />
        </section>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="panel-hot rounded-2xl p-6 text-center">
          <p className="text-sm text-muted">
            Check your own claim against four independent miners.
          </p>
          <Link href="/verify" className="btn-primary mt-4 text-sm">
            Verify a claim
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
