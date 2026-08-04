# Architecture

In-depth technical design of Signal Arena for reviewers, teammates, and judges who want more than the README.

---

## 1. Product shape

Signal Arena is three surfaces on one oracle core:

| Surface | Role |
|---------|------|
| **Oracle core** | Fuse four miners into a receipted verdict |
| **Markets** | Demo of threshold settlement + conviction |
| **Adversary** | Competitive red-team loop that spends the same core |

The submission pitch is infrastructure-first:

> `POST /api/oracle/verify` is a paid, multi-miner verify endpoint. Markets and Adversary prove it in a human UI. `/ledger` proves demand for Track 1.

---

## 2. System diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / curl                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│  Pages: /  /markets  /challenge  /ledger  /leaderboard       │
│  API:   /api/oracle/verify  /api/ledger  /api/cron/oracle …  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  Oracle pipeline          │   │  Persist layer              │
│  lib/oracle.ts            │   │  lib/persist.ts + lib/db.ts │
│  fuseClaim / verifyClaim  │   │  Turso KV JSON or .data/    │
│  runOracleTick            │   │  markets, ticks, ledger,    │
│  runChallenge             │   │  challenges, activity       │
│  generateMarketsFromNews  │   └─────────────────────────────┘
│  runCronCycle             │
└───────────────┬───────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Miner client  lib/telegraph/clients.ts                      │
│  + x402 wrap   lib/telegraph/x402.ts                         │
│  + call context lib/telegraph/call-context.ts (ALS)          │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTP + x402 Payment Required
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Telegraph node  TELEGRAPH_NODE_URL:7044                     │
│  /miner-dispatcher/v1/{minerId}{path}                        │
│  Accepts exact scheme eip155:84532 (Base Sepolia USDC)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Oracle pipeline

### 3.1 Stages

| # | Role | Default miner | Path | Failure behavior |
|---|------|---------------|------|------------------|
| 1 | Evidence | **202** Tavily | `POST /search` | Fall back to **210** GNews; then empty sources |
| 2 | Authenticity | **115** DeepSeek | `POST /chat` | Local heuristic score; mark stage degraded |
| 3 | Judge A | **110** OpenRouter | `POST /chat` | `allSettled`; missing judge blocks YES |
| 4 | Judge B | **104** LiteLLM Nova | `POST /chat` | Same |

Model IDs and labels are env-driven (`AUTH_MODEL`, `REASON_MODEL`, `CONSENSUS_MODEL`, `*_LABEL`). Catalog prose on the node is not trusted blindly; miners were probe-validated.

**Why not ItsAI 32 / Gemini 109?**  
32 is not a reliable post-pay integration on this node. 109 returned upstream Gemini quota 429s. Authenticity uses **115** so multi-intent remains four real integrations.

### 3.2 Settlement rule (markets)

A market settles **YES** only when all of the following hold:

1. Judge A and Judge B **both return**, and **agree** on `yes`  
2. Averaged (or consensus) confidence ≥ market `confidenceThreshold`  
3. Authenticity does **not** score synthetic above the gate (default: AI-likely with score ≥ 0.7)  
4. Stages that would make consensus impossible are not missing  

If judges disagree, or one judge is missing, verdict is **uncertain** (or a safe non-YES).  
If authenticity flags synthetic, a YES is downgraded to **uncertain**.  
Expired open markets can settle **NO** on timeout of the window.

Degraded readings always report:

```json
"stages": { "total": 4, "completed": N, "degraded": ["authenticity", ...] }
```

### 3.3 Adversary scoring

Same four-stage stack (with degradation).  
**Fool score** rises when judges lean YES and confidence is high.  
A **break** requires both judges YES with confidence ≥ 0.72.  
Breaks appear in the Hall of breaks and activity feed as regression cases.

### 3.4 Public verify

`verifyClaim` runs `fuseClaim` with context `api:verify`.  
No market is required. Response includes verdict, confidence, sources, authenticity, consensus, proofs, stage stats, and cost estimate.

Rate limits:

- Per-IP token bucket (`VERIFY_PER_IP_HOURLY`, default 6)  
- Rolling 24h spend from ledger (`VERIFY_DAILY_CAP_USDC`, default 2)

---

## 4. Payments (x402)

Implementation: `lib/telegraph/x402.ts`

1. Client uses `wrapFetchWithPaymentFromConfig` from `@x402/fetch`.  
2. Registers **ExactEvmScheme** for `EVM_NETWORK` (default `eip155:84532`).  
3. Optionally registers Solana SVM if a Solana key is present (usually unused on this node).  
4. On `402 Payment Required`, signs EIP-3009-style transfer and retries.  
5. Settlement headers yield a `txHash` stored on the proof and ledger.

Live probe amount: **10000** base units = **0.01 USDC** per successful call (`COST_USDC_PER_CALL`).

Failed upstream calls after payment negotiation failures are ledgered as `success: false` with **zero cost**.

---

## 5. Ledger integrity

Problem solved: if logging only ran after all stages finished, a failure mid-pipeline hid already-paid calls.

Solution:

1. `minerRequest` always calls `db.recordCall` when a request finishes (ok or fail).  
2. Context (`api:verify`, `market:{id}`, `challenge`, `auto:market-scan`, …) is supplied via **AsyncLocalStorage** (`call-context.ts`) so call sites do not thread a string through every helper.  
3. `/ledger` and `GET /api/ledger` read the consumption log + aggregates by miner.

This is the Track 1 demand surface.

---

## 6. Persistence

`lib/persist.ts` + `lib/db.ts`

| Backend | When | Storage |
|---------|------|---------|
| **Turso** | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` set | Single KV row JSON blob |
| **Local file** | Otherwise | `.data/store.json` |

Stored aggregates:

- markets, stakes (conviction), ticks, challenges  
- consumption (ledger), activity (live tape)  
- minerRequests, totalCostUsdc, lastCronAt, seedVersion  

JSON blob is simple and sufficient for hackathon scale. A normalized SQL schema can replace it later without changing the oracle.

---

## 7. Markets lifecycle

```
seed (first boot)
   or
POST /api/markets/from-headline  ──► createMarket (source: user)
   or
cron generateMarketsFromNews ────► createMarket (source: auto)
   │
   ▼
open market
   │
   ├── POST stake (conviction YES/NO)
   │
   ├── POST oracle  or  cron runOracleTick
   │         │
   │         └── fuseClaim → tick → maybe settle
   │
   └── closesAt expires → settle NO on next tick
```

### Auto markets (cron)

`runCronCycle`:

1. `generateMarketsFromNews(2)`  
   - Tavily search for exploit / flight / contradicted-claim topics  
   - Chat miner returns JSON market proposals  
   - Skip title duplicates; create up to 2 markets (`source: "auto"`)  
2. `runAllOpenOracles()` ticks every open market  
3. `setLastCronAt`

Spend note: each cron cycle can spend several miner calls (scan + frame + 4× open markets). Arm cron only with a funded wallet.

---

## 8. Frontend structure

| Area | Responsibility |
|------|----------------|
| `app/*` | Routes, server components, API handlers |
| `components/*` | Client UI (markets, adversary, landing, ledger helpers) |
| `lib/oracle.ts` | Domain orchestration |
| `lib/telegraph/*` | Node I/O, payments, ALS context |
| `lib/db.ts` | Domain store API |
| `lib/rate-limit.ts` | In-memory IP buckets for verify |

UI language: **conviction** for demo positions; real money appears on the **ledger**.

---

## 9. Configuration surface

Primary env file: `.env.example` (copy to `.env.local`).

Critical groups:

| Group | Keys |
|-------|------|
| Node | `TELEGRAPH_NODE_URL`, `MINER_DISPATCHER_PREFIX` |
| Miners | `NEWS_*`, `AUTH_*`, `REASON_*`, `CONSENSUS_*` |
| Pay | `EVM_PRIVATE_KEY`, `EVM_NETWORK` |
| Limits | `VERIFY_PER_IP_HOURLY`, `VERIFY_DAILY_CAP_USDC` |
| Cron | `CRON_SECRET`, `ORACLE_INTERVAL_MINUTES` |
| Store | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| Mode | `FORCE_MOCK` |

Do not commit `.env.local`. Rotate keys if they leak.

---

## 10. Reliability notes for demos

| Risk | Mitigation in product |
|------|------------------------|
| Free-tier judge flake (e.g. miner 104) | `allSettled`; degrade; show FAIL rows on ledger |
| Authenticity miner down | Heuristic fallback; no YES settle |
| News miner down | Alt miner / empty sources; no YES settle |
| Public verify griefing | IP rate limit + daily USDC cap |
| Serverless state wipe | Turso |
| Hobby cron once/day | Document cron-job.org every 15m |

Authenticity gate intentionally blocks “both judges YES but coverage looks synthetic.” That is a feature for the pitch, not a bug.

---

## 11. Security

- Server holds `EVM_PRIVATE_KEY`. Use a **burner** funded only for the demo.  
- Verify is public but throttled; do not remove the cap on a public URL without another budget control.  
- Cron requires `CRON_SECRET` (or Vercel cron header).  
- No user auth for conviction handles (demo trust model).  

---

## 12. Future work (out of scope for H1)

- On-chain conviction pots / escrow with the same x402 wallet  
- Normalized SQL ledger with per-miner analytics  
- Webhooks when markets settle (agent automation)  
- Swap judges when free-tier quality drops  
- Re-enable ItsAI / BitMind when those integrations are healthy again  

---

## 13. File index (core)

```
src/lib/oracle.ts                 fusion, challenge, cron, auto markets
src/lib/telegraph/clients.ts      miner HTTP + degrade + ledger write
src/lib/telegraph/x402.ts         payment wrap
src/lib/telegraph/call-context.ts ALS context for ledger attribution
src/lib/db.ts                     domain store
src/lib/persist.ts                Turso / file
src/lib/rate-limit.ts             verify throttle
src/lib/markets-from-headline.ts  user market factory
src/app/api/oracle/verify         public infrastructure API
src/app/api/cron/oracle           always-on cycle
src/app/api/ledger                demand JSON
src/app/ledger                    demand UI
```

For user-facing setup and walkthroughs, see **[README.md](./README.md)**.
