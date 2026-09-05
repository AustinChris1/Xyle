# Xyle

**A verifiable multi-miner oracle on [Telegraph Protocol](https://telegraphprotocol.com), with markets and an adversary game as demos of the same rail.**

Hackathon: [Telegraph Season I](https://hackathon.telegraphprotocol.com) · Application Track

| What it is | What it is not |
|------------|----------------|
| A receipted oracle: news + authenticity + dual judges | A human-resolved prediction market |
| Paid per reading via x402 (Base Sepolia USDC) | Free unlimited API access |
| Infrastructure others can call (`POST /api/oracle/verify`) | Only a UI for three seeded questions |

---

## Documentation

Everything lives in [`docs/`](./docs) as plain markdown, and the same files are
rendered by the app at **`/docs`** so a visitor never has to open GitHub.

| Doc | Read it for |
|---|---|
| [Overview](./docs/overview.md) | What this is, the problem it solves, and where to go next |
| [How it works](./docs/how-it-works.md) | The use case, told through one real user, and what the four stages actually do |
| [Usage](./docs/usage.md) | Every page in the app, what it is for, and what to click |
| [Architecture](./docs/architecture.md) | Internals: modules, data flow, persistence, failure handling |
| [Keys](./docs/keys.md) | Wallets, the payment network, and funding a burner |

New here? Start with **Overview**, which is what `/docs` opens on.

---

## Surfaces

| Surface | What it is |
|---|---|
| **`/verify`** | Check any claim. Returns a permanent link with dated sources, both judges, and on-chain receipts |
| **`/c/[id]`** | The permalink. Every verification is a citable page with its own share card |
| **`/pulse`** | Live health for all 40 miners in the Telegraph catalog, plus embeddable badges |
| **`/badge/[id].svg`** | Status badge a miner operator can drop in their README |
| **`/calibration`** | The oracle's own track record: when it says 80%, is it right 80% of the time |
| **`/ledger`** | Every paid miner call: who, cost, latency, receipt |
| **`/api/mcp`** | MCP server, so an agent can verify a claim before acting on it |
| `/markets`, `/challenge` | Two consumers of the same rail |

### Pulse, and why it matters

Because Xyle actually pays these miners for real work, it accumulates something
nobody else has: a measured record of which parts of Telegraph function.

Two independent signals, deliberately not collapsed into one number:

- **Routable** — free. An unpaid request returns `402 Payment Required`, so the
  node still dispatches to that miner. Runs over the whole catalog every cycle.
- **Live** — costs ~0.01 USDC. Actually pay and see whether the upstream
  answers. A rotating handful per cycle, plus every real call the app makes.

The gap between them is the whole point. Miner 109 stayed *routable* for weeks
while its upstream Gemini quota was exhausted, and miner 202 currently reads
**routable 100%, live 50%**. A single uptime number would hide both.

Miner operators can embed their own badge:

```markdown
![Telegraph miner 202](https://usexyle.vercel.app/badge/202.svg)
```

### MCP

```json
{ "mcpServers": { "xyle": { "url": "https://usexyle.vercel.app/api/mcp" } } }
```

Tools: `verify_claim`, `get_miner_health`, `get_claim`. The instruction given to
clients is that `uncertain` means *do not act* — the point of an agent guardrail
is that it refuses rather than guesses.

---

## How it works (plain language)

Every **reading** of a claim buys four stages from live Telegraph miners:

```
Claim or market question
        │
        ▼
┌───────────────────┐
│ 1. Evidence       │  Miner 202 · Tavily web/news search
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ 2. Authenticity   │  Miner 115 · DeepSeek (is this synthetic / farmed?)
└─────────┬─────────┘
          ▼
┌───────────────────┐     ┌───────────────────┐
│ 3. Judge A        │     │ 4. Judge B        │
│ Miner 110         │     │ Miner 104         │
│ OpenRouter        │     │ LiteLLM Nova      │
└─────────┬─────────┘     └─────────┬─────────┘
          └───────────┬─────────────┘
                      ▼
              Dual consensus
                      │
        YES only if both judges say YES
        AND confidence clears the bar
        AND authenticity is not synthetic
                      │
                      ▼
              Verdict + proofs + ledger rows
```

**If a stage fails**, the oracle does not crash the whole reading. It degrades, marks which stages completed, and **never settles YES** on incomplete consensus.

**Every miner call** (success or fail) is written to the **consumption ledger** as soon as it returns. That is the public demand scoreboard for Track 1 miners.

---

## What you can do as a user

### 1. Markets (`/markets`)

1. **Open a market** by pasting a headline (or wait for auto markets; see below).
2. Mark **conviction** YES or NO (demo units, not bank money).
3. Trigger a **reading** with the button, or wait for the **cron** cycle.
4. If both judges agree YES, confidence is high enough, and authenticity is clean, the market **settles**.

Real USDC is spent on the **miner readings**, not on the demo conviction pot. Open **`/ledger`** to see spend and receipts.

### 2. Break it (`/challenge`)

1. Write a claim (at least **80 characters**).
2. Submit. The same four-stage pipeline scores how close you got to a false YES.
3. High score = you almost (or did) break the oracle. Low score = the desk held.
4. **Hall of breaks** lists claims that beat dual-judge consensus. That is a public red-team set.

### 3. Consumption ledger (`/ledger`)

Public table of miner demand: miner id, role, latency, estimated USDC, receipt, context.  
Use this to prove real demand for Track 1, and to explain flaky free-tier miners during a demo.

### 4. Infrastructure API

Other apps (or curl) can buy a full reading without the UI:

```bash
# Docs
curl http://localhost:3000/api/oracle/verify

# Verify a claim (spends real USDC on live mode)
curl -X POST http://localhost:3000/api/oracle/verify \
  -H "content-type: application/json" \
  -d "{\"claim\":\"Was a major DeFi protocol exploited in a material on-chain attack recently?\"}"
```

**Limits (live wallet protection):**

- About **6 requests per IP per hour** (configurable)
- About **2 USDC rolling 24h budget** for this endpoint (configurable)

### 5. Leaderboard (`/leaderboard`)

Conviction outcomes + adversary scores.

### 5b. Outbound webhooks

Both the **personal webhook** and each **agent** fire on the same trigger: a
market **you watch** reaching a settled state. The difference is only shape.

| | Personal webhook | Agent |
|---|---|---|
| How many | One per account | Many, each named |
| Payload | No `agentId` | Includes `agentId` |
| Delivery result | Not reported | Success or failure lands in your alerts |

Request:

```http
POST <your url>
Content-Type: application/json
X-Xyle-Signature: sha256=<hmac-sha256 of the raw body>

{
  "type": "market.settled",
  "at": "2026-08-04T09:12:00.000Z",
  "market": {
    "id": "mkt_...",
    "title": "Will a major DeFi protocol exploit be confirmed...?",
    "status": "settled_yes",
    "verdict": "yes",
    "confidence": 0.86
  },
  "tick": { "id": "tick_...", "verdict": "yes", "confidence": 0.86, "settled": true },
  "agentId": "agt_..."
}
```

Verify it in your receiver:

```js
const expected =
  "sha256=" +
  crypto.createHmac("sha256", process.env.WEBHOOK_SECRET)
        .update(rawBody)   // the raw body, before JSON.parse
        .digest("hex");
// compare with crypto.timingSafeEqual against the header
```

**URL rules.** Callbacks must be `https` and must resolve to a public host.
Loopback, private (RFC1918), link-local, and cloud-metadata addresses are
rejected at registration and again at delivery, and redirects are refused,
because the server fetches these URLs. For local testing against
`http://localhost`, set `ALLOW_INSECURE_WEBHOOKS=true`.

Delivery is best-effort with an 8 second timeout and **no retry**.

#### Try it in 30 seconds

Waiting for a real settlement to test an endpoint is impractical, so both the
personal webhook and every agent have a **Send test event** button on `/desk`.

1. Open <https://webhook.site>. It gives you a unique https URL and shows every
   request it receives, live. Nothing to install, no signup.
2. Copy the URL, for example
   `https://webhook.site/f6689be2-ccc9-4102-83d5-07a37667d518`.
3. Paste it into **Personal webhook** and press Save, or register it as an
   agent with any name.
4. Press the ⚡ **Send test event** button.
5. The webhook.site tab shows the POST instantly, including the
   `X-Xyle-Signature` header.

Any URL that accepts a POST works the same way: a Pipedream or RequestBin
endpoint, a Zapier or Make catch hook, an n8n webhook node, or your own server.
For a local receiver, expose it with `ngrok http 3000` and use the https URL it
prints, or set `ALLOW_INSECURE_WEBHOOKS=true` to allow plain `localhost`.

The test event is identical in shape to a real one except `type` is
`webhook.test` and the market ids are `mkt_test` / `tick_test`, so a receiver
can safely ignore it in production:

```js
if (body.type === "webhook.test") return res.status(200).end();
```

```http
POST /api/me/webhooks/test      # session cookie required
{ "agentId": "agt_..." }        # omit agentId to test the personal webhook
```

### 6. My desk (`/desk`) — SIWE identity

1. **Connect wallet** (any EIP-6963 wallet: MetaMask, Rabby, Phantom, ...).
   Connecting immediately asks you to sign a SIWE message, so it is one action.
   Dismissing the signature leaves you connected with a **Sign in** fallback.
2. On **My desk** you get:
   - editable **handle**
   - **watchlist** of markets + keyword filters
   - **alerts** when watched markets settle or cross confidence
   - **personal webhook**: one URL, fires on every settle you watch
   - **agents**: named callbacks, same trigger, each tagged with its `agentId`
     and each reporting delivery success or failure back into your alerts

Miner fees always come from the **app server** wallet. Your wallet is identity, not a payment source.

Share cards use your handle, e.g. `@alice · market settled YES @ 85%`.

---

## Auto market postings

**Yes.** When the cron job runs, Xyle:

1. Searches live news (Tavily) for high-signal topics (exploits, flight chaos, contradicted crypto claims).
2. Asks a chat miner to turn that into short **yes/no market questions**.
3. Opens up to **2 new markets** if they are not duplicates.
4. **Ticks every open market** through the full oracle pipeline.

You do **not** need to click anything for that cycle, once cron is armed.

| How markets appear | When |
|--------------------|------|
| Seeded demo markets | First time the database is empty |
| **You** paste a headline on `/markets` | Immediately |
| **Auto** from news | Each successful cron cycle |
| API `POST /api/markets` or `POST /api/markets/from-headline` | When you call it |

Cron endpoint:

```http
GET /api/cron/oracle
Authorization: Bearer <CRON_SECRET>
```

or

```http
GET /api/cron/oracle?secret=<CRON_SECRET>
```

`vercel.json` is pinned to `0 6 * * *` (once daily). **Vercel Hobby caps cron at
once per day and rejects any more frequent expression at deploy time**, so
putting `*/15 * * * *` back will fail the deploy unless the project is on Pro.

For the 15 minute demo cadence, drive it externally with a free scheduler such
as [cron-job.org](https://cron-job.org) hitting the same URL. That also keeps
the cadence working on any host.

The UI shows a **“next reading in m:ss”** countdown based on the last cron / last reading.

### Running the cron, three ways

`CRON_SECRET` must be set or the endpoint returns **503** before doing anything.

**A cycle is bounded on purpose.** One reading takes ~13s and costs ~0.04 USDC,
so ticking every open market in a single invocation does not fit: measured at
17 open markets it ran well past the **60s** Vercel function ceiling, and at a
15 minute cadence it would drain a 20 USDC wallet in hours.

Instead each cycle ticks `CRON_MARKETS_PER_CYCLE` markets, **oldest-read
first**, so every market still gets covered on rotation. Measured locally:

| Setting | Wall time | Cost per cycle |
|---|---|---|
| 2 markets + 1 auto market (default) | ~40s | ~0.10 USDC |
| 3 markets + 1 auto market | **53s** (too close to the 60s cap) | ~0.14 USDC |

`CRON_DAILY_CAP_USDC` (default 5) is a hard stop checked from the ledger before
any spend. Once the rolling 24h total passes it, the endpoint returns in
milliseconds having done nothing:

```json
{"ok":true,"skippedReason":"daily budget reached","spentUsdcLast24h":2.87,"capUsdc":1}
```

At the default 5 USDC/day a ~20 USDC burner survives about four days of
continuous operation. Raise the cap only if the wallet can back it.

**The endpoint answers immediately.** A cycle takes ~40s, which is longer than
most schedulers wait (cron-job.org's free tier cuts off at **30s**). So the
route sends its response first and runs the cycle in Next's `after()`, which
stays alive up to `maxDuration`. Measured: **HTTP 202 in 80ms**, cycle finishes
~50s later.

```json
{"ok":true,"mode":"scheduled","willTick":2,"openMarkets":18,
 "spentUsdcLast24h":2.95,"capUsdc":5}
```

**Two schedules.** The oracle cycle (~40s) and Pulse (~23s) together exceed the
60s function ceiling, so they are separate endpoints:

| Endpoint | Does | Suggested cadence |
|---|---|---|
| `/api/cron/oracle` | Auto-markets + readings | hourly |
| `/api/cron/pulse` | Catalog health probing | hourly |

Both take the same `CRON_SECRET` and both answer in milliseconds via `after()`.

**A. Locally, one manual cycle.** Add `sync=1` to run inline and see results:

```bash
curl "http://localhost:3000/api/cron/oracle?secret=$CRON_SECRET&sync=1"
```

Without `sync=1` you get the fast 202 and check `/ledger` or `/api/stats` for
the outcome. Never use `sync=1` from a scheduler; it will time out.

**B. Locally, on a loop.** A terminal you leave running:

```bash
while true; do
  curl -s "http://localhost:3000/api/cron/oracle?secret=$CRON_SECRET" \
    | head -c 200; echo;
  sleep 900   # 15 minutes
done
```

**C. Deployed, always on.** This is the one that matters for judging, because
the app keeps working while nobody is watching.

1. Deploy, then set `CRON_SECRET` in Vercel project settings and redeploy so
   the value is live.
2. Confirm it responds:
   `curl "https://usexyle.vercel.app/api/cron/oracle?secret=YOUR_SECRET"`
3. Sign up free at [cron-job.org](https://cron-job.org) and create a job:
   - URL: `https://usexyle.vercel.app/api/cron/oracle?secret=YOUR_SECRET`
   - Schedule: every 15 minutes
   - Method: GET (the default 30s timeout is fine, the route answers in ms)
   - Optional: put the secret in an `Authorization: Bearer <secret>` header
     instead of the query string, so it stays out of their request logs
4. Watch the first execution turn green, then check `/ledger` for new rows.

Vercel's own daily cron in `vercel.json` still fires as a floor, so the app
stays alive even if the external scheduler is removed.

**Troubleshooting**

| Response | Meaning |
|---|---|
| `503 CRON_SECRET not configured` | Env var missing on the server. Redeploy after setting it. |
| `401 UNAUTHORIZED` | Secret in the URL does not match the deployed one. |
| `202` with `mode:"scheduled"` | Normal. The cycle runs after the response. |
| `{"ok":true,"oracle":{"results":[]}}` | Worked, but no markets were open. |
| `skippedReason: "daily budget reached"` | Rolling 24h spend hit `CRON_DAILY_CAP_USDC`. Working as designed. |
| Scheduler reports a timeout | You are probably calling it with `sync=1`. Drop it; the default mode answers in milliseconds. |
| Times out even without `sync=1` | Lower `CRON_MARKETS_PER_CYCLE`. Hobby caps total function time at 60s. |
| `oracle.skipped` is large | Normal. Those markets get read on later cycles. |

---

## Run locally

### Requirements

- **Node.js 20+**
- **pnpm** 9+
- Base Sepolia wallet with **ETH (gas)** and **USDC** (for live miners)

### Install

```bash
cd signal-arena
pnpm install
cp .env.example .env.local
```

### Wallet (live mode)

```bash
pnpm keys:evm --write
```

Then fund the printed **Base Sepolia** address:

1. ETH: [Alchemy Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia) or similar  
2. USDC: [Circle faucet](https://faucet.circle.com) → **Base Sepolia** → USDC  

Payment network expected by the live node: **`eip155:84532`** (Base Sepolia).  
Solana SOL alone does **not** pay these miner calls.

Details: [docs/keys.md](./docs/keys.md)

### Environment (minimum)

```env
FORCE_MOCK=false
TELEGRAPH_NODE_URL=http://13.237.89.59:7044
EVM_PRIVATE_KEY=0x...
EVM_NETWORK=eip155:84532
CRON_SECRET=choose-a-long-random-string
SESSION_SECRET=at-least-32-characters-for-siwe-cookies
WEBHOOK_SECRET=another-long-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate the three secrets with:

```bash
node -e "const c=require('crypto');for(const k of ['CRON_SECRET','SESSION_SECRET','WEBHOOK_SECRET'])console.log(k+'='+c.randomBytes(32).toString('base64url'))"
```

Optional but recommended for Vercel:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_APP_URL=https://usexyle.vercel.app
```

Without Turso, data is stored under `.data/store.json` (fine locally; wiped on serverless cold starts without Turso).

### Start

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Local development |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm keys:evm` | Generate free Base Sepolia keypair |
| `pnpm keys:evm --write` | Write key into `.env.local` |

### First walkthrough

1. Confirm the top ribbon shows **Oracle live** with a green dot.  
2. Go to **Markets** → paste a real headline → **Open market**.  
3. Record conviction YES/NO.  
4. Run a reading (or wait for cron).  
5. Open **Ledger** and confirm four rows with miner ids and receipts.  
6. Try **Break it** with ≥80 characters.  
7. Hit `GET /api/oracle/verify` for API docs.

### Simulation mode (no wallet)

```env
FORCE_MOCK=true
```

UI works without USDC. **Do not submit mock mode for judging.** Track 3 requires real Telegraph miners.

---

## Deploy (Vercel)

```bash
pnpm dlx vercel
```

Set the same env vars in the Vercel project. Add Turso for durable state. Arm cron (or cron-job.org) with `CRON_SECRET`.

---

## Project map (pages)

| Path | Purpose |
|------|---------|
| `/` | Product story, live activity tape |
| `/markets` | Board + “paste a headline” |
| `/markets/[id]` | Conviction, manual reading, proofs |
| `/challenge` | Break it + hall of breaks |
| `/ledger` | Public miner demand scoreboard |
| `/desk` | SIWE profile, watchlist, agents, alerts |
| `/leaderboard` | Scores |

### Main APIs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/oracle/verify` | Public multi-miner verify |
| `GET` | `/api/oracle/verify` | API docs |
| `GET` | `/api/ledger` | Ledger JSON |
| `GET` | `/api/activity` | Live tape JSON |
| `POST` | `/api/markets/from-headline` | Headline → market |
| `POST` | `/api/markets/[id]/oracle` | Manual reading |
| `POST` | `/api/challenge` | Break-it attempt |
| `GET` | `/api/cron/oracle` | Auto markets + tick all open |
| `GET` | `/api/stats` | Public status feed for the ribbon |
| `GET` | `/api/leaderboard` | Standings JSON |
| `GET/POST` | `/api/markets` | List / create markets |
| `POST` | `/api/markets/[id]/stake` | Record conviction |
| `GET` | `/api/auth/nonce` | SIWE nonce |
| `POST` | `/api/auth/verify` | SIWE verify, sets session |
| `POST` | `/api/auth/logout` | Clear session |
| `GET/PATCH` | `/api/me` | Desk payload / profile update |
| `GET/POST/DELETE` | `/api/me/agents` | Manage agent callbacks |
| `POST` | `/api/me/webhooks/test` | Send a sample event to an endpoint |
| `POST` | `/api/me/watchlist` | Toggle a watched market |

In-depth design: **[docs/architecture.md](./docs/architecture.md)**  
Wallets and payment network: **[docs/keys.md](./docs/keys.md)**

---

## Tech stack

- **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS** · **Framer Motion**  
- **pnpm**  
- **Telegraph** miner-dispatcher + **x402** (`@x402/fetch`, `@x402/evm`, `viem`)  
- **Turso / libSQL** (optional) or local JSON store  

---

## Hackathon notes

- **Track 3** apps must use **real** miners (no mock for submission).  
- Miners are also ranked by **application demand**. This app’s ledger is designed so Track 1 participants can point at real call volume.  
- Tag progress posts with **`@Telegraphprotoc`** when you demo on X.

---

## License

Private hackathon submission unless otherwise stated by the authors.
