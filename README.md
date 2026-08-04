# Signal Arena

**A verifiable multi-miner oracle on [Telegraph Protocol](https://telegraphprotocol.com), with markets and an adversary game as demos of the same rail.**

Hackathon: [Telegraph Season I](https://hackathon.telegraphprotocol.com) · Application Track

| What it is | What it is not |
|------------|----------------|
| A receipted oracle: news + authenticity + dual judges | A human-resolved prediction market |
| Paid per reading via x402 (Base Sepolia USDC) | Free unlimited API access |
| Infrastructure others can call (`POST /api/oracle/verify`) | Only a UI for three seeded questions |

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

### 2. Adversary (`/challenge`)

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

---

## Auto market postings

**Yes.** When the cron job runs, Signal Arena:

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

`vercel.json` schedules this every **15 minutes**. On **Vercel Hobby**, cron may only fire **once per day**. For a real always-on demo, use a free external scheduler such as [cron-job.org](https://cron-job.org) hitting the same URL every 15 minutes.

The UI shows a **“next reading in m:ss”** countdown based on the last cron / last reading.

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

Details: [KEYS.md](./KEYS.md)

### Environment (minimum)

```env
FORCE_MOCK=false
TELEGRAPH_NODE_URL=http://13.237.89.59:7044
EVM_PRIVATE_KEY=0x...
EVM_NETWORK=eip155:84532
CRON_SECRET=choose-a-long-random-string
```

Optional but recommended for Vercel:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_APP_URL=https://your-deploy.vercel.app
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

1. Confirm the top ribbon shows **LIVE MINERS** and **node up**.  
2. Go to **Markets** → paste a real headline → **Open market**.  
3. Record conviction YES/NO.  
4. Run a reading (or wait for cron).  
5. Open **Ledger** and confirm four rows with miner ids and receipts.  
6. Try **Adversary** with ≥80 characters.  
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
| `/challenge` | Adversary + hall of breaks |
| `/ledger` | Public miner demand scoreboard |
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
| `POST` | `/api/challenge` | Adversary attempt |
| `GET` | `/api/cron/oracle` | Auto markets + tick all open |

In-depth design: **[ARCHITECTURE.md](./ARCHITECTURE.md)**  
Wallets and payment network: **[KEYS.md](./KEYS.md)**

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
