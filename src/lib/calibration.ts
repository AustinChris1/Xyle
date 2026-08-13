import type { Market, OracleTick } from "./types";

/**
 * How well the oracle's confidence tracks reality.
 *
 * An oracle that says "90% confident" should be right about nine times in ten.
 * Without this, confidence is decoration. Publishing it before anyone asks is
 * the difference between claiming trustworthiness and showing it, and it costs
 * nothing because every settled market already carries the answer.
 */

export interface CalibrationBucket {
  /** Lower edge, e.g. 0.7 for the 70-80% band. */
  from: number;
  to: number;
  label: string;
  predictions: number;
  correct: number;
  /** correct / predictions */
  observed: number;
  /** Mean stated confidence inside the bucket. */
  stated: number;
}

export interface CalibrationReport {
  buckets: CalibrationBucket[];
  total: number;
  correct: number;
  accuracy: number;
  /**
   * Mean squared error between stated confidence and outcome. 0 is perfect,
   * 0.25 is what you get by always guessing 50%.
   */
  brier: number | null;
  /** Positive means overconfident: it claims more certainty than it earns. */
  gap: number | null;
}

const BUCKETS: Array<[number, number]> = [
  [0, 0.5],
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.01],
];

/**
 * Scores the reading that actually resolved each settled market.
 *
 * A market settled YES means the oracle said yes and was taken at its word, so
 * "correct" here measures agreement between the settling verdict and the final
 * status. Expired NO settlements count too: the oracle declined to confirm and
 * the deadline passed, which is the outcome it implied.
 */
export function calibrate(
  markets: Market[],
  ticks: OracleTick[]
): CalibrationReport {
  const byId = new Map(ticks.map((t) => [t.id, t]));

  const scored: Array<{ confidence: number; correct: boolean }> = [];

  for (const m of markets) {
    if (m.status !== "settled_yes" && m.status !== "settled_no") continue;

    const tick = m.settlementTickId ? byId.get(m.settlementTickId) : undefined;
    if (!tick) continue;

    const outcome = m.status === "settled_yes" ? "yes" : "no";

    // Only readings that actually asserted something are scoreable. An
    // "uncertain" verdict made no claim, so grading it would be meaningless.
    if (tick.verdict !== "yes" && tick.verdict !== "no") continue;

    scored.push({
      confidence: tick.confidence,
      correct: tick.verdict === outcome,
    });
  }

  const buckets: CalibrationBucket[] = BUCKETS.map(([from, to]) => {
    const inBucket = scored.filter(
      (s) => s.confidence >= from && s.confidence < to
    );
    const correct = inBucket.filter((s) => s.correct).length;
    return {
      from,
      to,
      label:
        from === 0
          ? "under 50%"
          : `${(from * 100).toFixed(0)}–${(Math.min(to, 1) * 100).toFixed(0)}%`,
      predictions: inBucket.length,
      correct,
      observed: inBucket.length ? correct / inBucket.length : 0,
      stated: inBucket.length
        ? inBucket.reduce((a, s) => a + s.confidence, 0) / inBucket.length
        : 0,
    };
  });

  const total = scored.length;
  const correct = scored.filter((s) => s.correct).length;

  const brier =
    total > 0
      ? scored.reduce(
          (acc, s) => acc + Math.pow(s.confidence - (s.correct ? 1 : 0), 2),
          0
        ) / total
      : null;

  const gap =
    total > 0
      ? scored.reduce((a, s) => a + s.confidence, 0) / total - correct / total
      : null;

  return {
    buckets,
    total,
    correct,
    accuracy: total ? correct / total : 0,
    brier,
    gap,
  };
}
