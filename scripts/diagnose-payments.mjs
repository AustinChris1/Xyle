/**
 * Why does a miner return `402 {}`?
 *
 * The Pulse deep probe pays miners 104, 117 and 115 successfully, while the
 * market factory gets a bare 402 with no body from the same miners on the same
 * path. A 402 carrying no payment requirements cannot be paid: the x402 client
 * has no `accepts` array to build an authorization from, so it gives up and
 * hands the 402 straight back.
 *
 * This isolates which part of the request causes that. Run it and read the
 * table: whatever differs between the row that gets `accepts` and the row that
 * does not is the cause.
 *
 *   node scripts/diagnose-payments.mjs
 */

import { readFileSync } from "node:fs";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    console.error("Could not read .env.local from the project root.");
    process.exit(1);
  }
  return out;
}

const env = loadEnv();
const NODE = (env.TELEGRAPH_NODE_URL || "http://13.237.89.59:7044").replace(/\/$/, "");
const NETWORK = env.EVM_NETWORK || "eip155:84532";
const KEY = env.EVM_PRIVATE_KEY;

if (!KEY) {
  console.error("EVM_PRIVATE_KEY missing from .env.local");
  process.exit(1);
}

const account = privateKeyToAccount(KEY.startsWith("0x") ? KEY : `0x${KEY}`);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(toClientEvmSigner(account)) }],
});

console.log(`node    ${NODE}`);
console.log(`network ${NETWORK}`);
console.log(`wallet  ${account.address}\n`);

/** The exact body Pulse uses, which is known to get paid. */
const tiny = (model) =>
  model === null
    ? { query: "bitcoin", q: "bitcoin", max_results: 1 }
    : ({
  model,
  messages: [
    { role: "system", content: "Reply with only the word OK." },
    { role: "user", content: "ping" },
  ],
  max_tokens: 8,
  temperature: 0,
});

/** Roughly the market factory body: a long system prompt and a real ceiling. */
const heavy = (model) => ({
  model,
  messages: [
    {
      role: "system",
      content:
        "Turn a headline into one yes/no prediction market about what happens NEXT. " +
        "Return ONLY JSON: {\"title\":\"...?\",\"description\":\"...\",\"eventClass\":\"other\",\"searchQuery\":\"...\"} " +
        "Rules: title must be a clear yes/no question that is not yet decided. " +
        "Never reference a year earlier than 2026. Do not restate the headline as a question about the past.",
    },
    { role: "user", content: "Tether-backed Orionx to shut down after audit flags $7M custody gap" },
  ],
  max_tokens: 160,
  temperature: 0.2,
});

/** Same long prompt, but the tiny ceiling, to separate size from ceiling. */
const heavyPromptTinyCap = (model) => ({ ...heavy(model), max_tokens: 8 });

/** Tiny prompt, big ceiling, the other half of that separation. */
const tinyPromptBigCap = (model) => ({ ...tiny(model), max_tokens: 160 });

async function probe(label, minerId, path, body, pay) {
  const url = `${NODE}/miner-dispatcher/v1/${minerId}${path}`;
  const doFetch = pay ? paidFetch : fetch;
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const text = await res.text().catch(() => "");
    // x402 can deliver payment requirements in headers rather than the body.
    // If the body is null but a header carries them, the client is simply
    // reading the wrong place and the fix is a library upgrade.
    const hdrs = {};
    res.headers.forEach((v, k) => {
      if (/pay|402|x402|www-authenticate|accept/i.test(k)) hdrs[k] = v.slice(0, 160);
    });
    if (Object.keys(hdrs).length) {
      console.log(`      headers: ${JSON.stringify(hdrs)}`);
    }
    let accepts = "-";
    if (res.status === 402) {
      try {
        const j = JSON.parse(text);
        const arr = j.accepts ?? j.paymentRequirements ?? null;
        accepts = Array.isArray(arr) ? `yes (${arr.length})` : "NONE";
      } catch {
        accepts = text.trim() ? "unparseable" : "EMPTY BODY";
      }
    }
    return { label, status: res.status, accepts, snippet: text.trim().slice(0, 110) };
  } catch (err) {
    return { label, status: "ERR", accepts: "-", snippet: String(err.message).slice(0, 110) };
  }
}

const MINERS = [
  // 202 is the control: it settled a real payment at 06:42 today, so if it
  // now behaves like the others the fault is the node, not the miners.
  { id: "202", path: "/search", model: null },
  { id: "104", path: "/chat", model: env.CONSENSUS_MODEL || "nova-2-lite" },
  { id: "117", path: "/chat", model: env.REASON_FALLBACK_MODEL || "qwen" },
  { id: "115", path: "/chat", model: env.AUTH_MODEL || "deepseek" },
];

const CASES = [
  ["unpaid tiny         ", tiny, false],
  ["unpaid heavy        ", heavy, false],
  ["unpaid heavy+cap8   ", heavyPromptTinyCap, false],
  ["unpaid tiny+cap160  ", tinyPromptBigCap, false],
  ["PAID   tiny         ", tiny, true],
  ["PAID   heavy        ", heavy, true],
];

for (const m of MINERS) {
  console.log(`\n=== miner ${m.id}  model="${m.model}"  path=${m.path} ===`);
  console.log("case                   status  accepts?      body");
  for (const [label, mk, pay] of CASES) {
    const r = await probe(label, m.id, m.path, mk(m.model), pay);
    console.log(
      `${label} ${String(r.status).padEnd(6)}  ${String(r.accepts).padEnd(12)}  ${r.snippet}`
    );
  }
}

console.log(`
Read it like this:
  unpaid rows with accepts=yes  -> the miner quotes a price, so it is payable
  unpaid rows with EMPTY BODY   -> no quote, so nothing can pay it
  If tiny quotes but heavy does not, the request itself is being rejected
  before the paywall, and the fix is the request, not the wallet.
`);
