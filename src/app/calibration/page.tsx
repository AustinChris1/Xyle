import type { Metadata } from "next";
import { db } from "@/lib/db";
import { calibrate } from "@/lib/calibration";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calibration",
  description:
    "Does the oracle's confidence mean anything? Its own track record on every settled market, published whether it flatters us or not.",
};

export default async function CalibrationPage() {
  const [markets, ticks] = await Promise.all([
    db.listMarkets(),
    db.listTicks(),
  ]);
  const report = calibrate(markets, ticks);
  const scored = report.buckets.filter((b) => b.predictions > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">Track record</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Calibration
        </h1>
        <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
          When the oracle says it is 80% confident, is it right four times in
          five? This is its own scorecard across every settled market, published
          whether or not it flatters us. An oracle asking to be trusted should
          show this before anyone thinks to ask.
        </p>
      </header>

      {report.total === 0 ? (
        <div className="panel rounded-xl px-6 py-14 text-center">
          <p className="text-muted">
            Nothing scoreable yet. Confidence can only be graded once markets
            settle on a definite yes or no.
          </p>
        </div>
      ) : (
        <>
          <Reveal>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Scored", v: String(report.total), c: "text-ink" },
                {
                  k: "Accuracy",
                  v: `${(report.accuracy * 100).toFixed(0)}%`,
                  c: report.accuracy >= 0.5 ? "text-yes" : "text-no",
                },
                {
                  k: "Brier score",
                  v: report.brier !== null ? report.brier.toFixed(3) : "—",
                  c: "text-copper",
                },
                {
                  k: report.gap !== null && report.gap > 0 ? "Overconfident by" : "Underconfident by",
                  v:
                    report.gap !== null
                      ? `${Math.abs(report.gap * 100).toFixed(0)}pts`
                      : "—",
                  c:
                    report.gap !== null && Math.abs(report.gap) < 0.1
                      ? "text-yes"
                      : "text-warn",
                },
              ].map((cell) => (
                <div key={cell.k} className="panel rounded-xl p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
                    {cell.k}
                  </div>
                  <div className={`mt-1 font-mono text-2xl tabular ${cell.c}`}>
                    {cell.v}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <section className="panel rounded-xl p-5 sm:p-6">
              <h2 className="eyebrow">Stated vs observed</h2>
              <p className="mt-2 text-sm text-muted">
                Each band compares what the oracle claimed against what actually
                happened. Bars matching means the confidence number is honest.
              </p>

              <div className="mt-6 space-y-5">
                {scored.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                      <span className="text-ink">{b.label}</span>
                      <span className="text-faint">
                        {b.correct}/{b.predictions} correct
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 font-mono text-[9px] uppercase text-faint">
                          Said
                        </span>
                        <div className="meter flex-1">
                          <div
                            className="h-full bg-copper"
                            style={{ width: `${b.stated * 100}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted tabular">
                          {(b.stated * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 font-mono text-[9px] uppercase text-faint">
                          Was
                        </span>
                        <div className="meter flex-1">
                          <div
                            className={`h-full ${
                              Math.abs(b.observed - b.stated) < 0.15
                                ? "bg-yes"
                                : "bg-warn"
                            }`}
                            style={{ width: `${b.observed * 100}%` }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted tabular">
                          {(b.observed * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section className="panel rounded-xl p-5">
              <h2 className="eyebrow">Reading this honestly</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                <li>
                  <span className="text-ink">Brier score</span> is mean squared
                  error between confidence and outcome. Lower is better; 0.25 is
                  what you would score by always saying 50%.
                </li>
                <li>
                  <span className="text-ink">Uncertain verdicts are excluded.</span>{" "}
                  A reading that declined to assert anything cannot be graded
                  right or wrong.
                </li>
                <li>
                  <span className="text-ink">
                    {report.total} settled markets is a small sample.
                  </span>{" "}
                  Treat single bands with less than five predictions as noise
                  rather than signal.
                </li>
              </ul>
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}
