import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { VerifyClient } from "@/components/VerifyClient";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a claim",
  description:
    "Check any claim against four independent Telegraph miners and get a permanent, receipted verdict you can link to.",
};

const VERDICT_TONE: Record<string, string> = {
  yes: "text-yes",
  no: "text-no",
  uncertain: "text-warn",
};

export default async function VerifyPage() {
  const recent = await db.listClaims(8);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">The oracle, directly</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Verify a claim
        </h1>
        <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
          Four independent miners gather dated evidence, score it for synthetic
          copy, and rule on it separately. You get a permanent link with the
          sources and the on-chain receipts, or an honest refusal when the
          evidence is not there.
        </p>
      </header>

      <VerifyClient />

      {recent.length > 0 && (
        <Reveal>
          <section>
            <h2 className="eyebrow">Recently checked</h2>
            <ul className="mt-3 space-y-2">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.id}`}
                    className="panel group flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors hover:border-copper/35"
                  >
                    <span className="line-clamp-1 text-sm text-ink transition-colors group-hover:text-copper-hot">
                      {c.claim}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-xs uppercase ${
                        VERDICT_TONE[c.verdict] ?? "text-muted"
                      }`}
                    >
                      {c.verdict} {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="panel rounded-2xl p-6">
          <h2 className="eyebrow">From your own code</h2>
          <div className="mt-3 overflow-x-auto">
            <pre className="font-mono text-[11px] leading-relaxed text-muted">
{`curl -X POST https://your-app/api/oracle/verify \\
  -H "content-type: application/json" \\
  -d '{"claim":"..."}'

# → { "id": "c_...", "permalink": "https://your-app/c/c_...", "result": {...} }`}
            </pre>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
