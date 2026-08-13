import { NextResponse, after } from "next/server";
import { loadConfig } from "@/lib/config";
import { flushSaves } from "@/lib/persist";
import { runPulseCycle, withPulseContext } from "@/lib/telegraph/pulse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pulse runs on its own schedule, not inside the oracle cron.
 *
 * A full oracle cycle is already ~40s and Pulse adds ~23s, which together
 * exceed the 60s function ceiling. Splitting them also lets Pulse run more
 * often than settlement, which is the right cadence anyway: the routability
 * sweep is free, so checking it hourly costs nothing.
 *
 * Like the oracle cron, this answers immediately and works in `after()` so an
 * external scheduler never sees a timeout.
 */
export async function GET(req: Request) {
  const cfg = loadConfig();
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const urlSecret = url.searchParams.get("secret");
  const vercelCron = req.headers.get("x-vercel-cron");

  if (!cfg.cronSecret && !vercelCron) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (
    cfg.cronSecret &&
    token !== cfg.cronSecret &&
    urlSecret !== cfg.cronSecret &&
    !vercelCron
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (url.searchParams.get("sync") === "1") {
    try {
      const result = await withPulseContext(() => runPulseCycle());
      await flushSaves();
      return NextResponse.json({ ok: true, mode: "sync", ...result });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  after(async () => {
    try {
      const result = await withPulseContext(() => runPulseCycle());
      await flushSaves();
      console.log("[pulse] cycle finished", JSON.stringify(result));
    } catch (err) {
      console.error("[pulse] cycle failed:", err);
    }
  });

  return NextResponse.json(
    {
      ok: true,
      mode: "scheduled",
      at: new Date().toISOString(),
      deepProbesPerCycle: cfg.pulseDeepPerCycle,
      note: "Probing runs after this response. Check /pulse for results.",
    },
    { status: 202 }
  );
}
