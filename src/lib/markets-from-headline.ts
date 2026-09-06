import { loadConfig } from "./config";
import { db } from "./db";
import { withCallContext } from "./telegraph/call-context";
import { chatJsonObject } from "./telegraph/clients";
import { currentYear, datePreamble } from "./prompt-context";
import type { Market } from "./types";

/** Paste a headline → open a market (user path). */
export async function createMarketFromHeadline(
  headline: string,
  player?: string,
  createdBy?: string
): Promise<Market> {
  const cfg = loadConfig();
  const h = headline.trim().slice(0, 400);
  if (h.length < 12) throw new Error("HEADLINE_TOO_SHORT");

  const framed = await withCallContext(
    { context: "user:headline-market" },
    () =>
      chatJsonObject(
        `${datePreamble()}

Turn a headline into one yes/no prediction market about what happens NEXT.
Return ONLY JSON:
{"title":"...?","description":"...","eventClass":"defi_exploit|flight_disruption|market_move|tech_outage|policy|corporate|sports|climate|other","searchQuery":"..."}

Rules:
- Title must be a clear yes/no question that is not yet decided.
- Never reference a year earlier than ${currentYear()}; prefer "in the next 7 days".
- Do not simply restate the headline as a question about the past.
- Keep "description" under 25 words. The whole JSON must fit in 160 tokens.`,
        h
      )
  );

  const title =
    typeof framed.data.title === "string" && framed.data.title.length > 12
      ? framed.data.title
      : `Is this material: ${h.slice(0, 100)}?`;
  const description =
    typeof framed.data.description === "string"
      ? framed.data.description
      : `Opened from headline by ${player || "user"}. Settles when multi-miner consensus clears the bar.`;
  const eventClass =
    typeof framed.data.eventClass === "string"
      ? framed.data.eventClass
      : "other";
  const searchQuery =
    typeof framed.data.searchQuery === "string"
      ? framed.data.searchQuery
      : h.slice(0, 80);

  return db.createMarket({
    title,
    description,
    eventClass,
    searchQuery,
    confidenceThreshold: cfg.defaultConfidence,
    closesInHours: 48,
    source: "user",
    sourceHeadline: h,
    createdBy,
    createdByHandle: player,
  });
}
