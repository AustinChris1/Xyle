---
title: Usage
summary: Every page in the app, what it is for, and what to click. Start here if you just landed.
order: 2
---

# Usage

What every page does and when you would use it. Nothing here requires a wallet
except where noted.

---

## Quick start

**Want an answer to one question?** → [Verify](/verify). Type a claim, wait
about forty seconds, get a link.

**Choosing which Telegraph miner to build on?** → [Pulse](/pulse).

**Wondering whether to trust any of this?** → [Calibration](/calibration).

---

## `/verify` — Check a claim

The main thing. Type a factual claim and four miners check it.

1. Write a claim of at least 20 characters. Something that either happened or
   did not, ideally in the last week or so.
2. Press **Verify this claim**. You will see each stage light up as it runs.
3. After ~40 seconds you land on a permalink.

Costs about $0.04 of the app's own USDC. You pay nothing.

**Good claims** are specific and recent: *"A major DeFi lending protocol was
exploited for over $10M this week."*

**Bad claims** are opinions (*"DeFi is unsafe"*), predictions about the future
(*"Bitcoin will hit $200k"*), or anything the press never covered. Those will
come back `uncertain`, which is the honest answer.

Limits: 6 checks per IP per hour, and a daily budget. Both exist because each
check spends real money.

> **Operators:** `/verify` reads `VERIFY_DAILY_CAP_USDC` (default **2**), which
> is a different setting from `CRON_DAILY_CAP_USDC` (default 5) used by the cron
> cycle. Raising one does not raise the other. Both are measured against the same
> ledger spend, so they share one pool of real USDC. On Vercel, env changes only
> apply to new deployments, so redeploy after changing either.

---

## `/c/[id]` — A verdict, permanently

Every check gets its own page:

- The claim, and the verdict: **supported**, **not supported**, or **not established**
- Confidence, and how the two judges voted individually
- Every source with its **publication date and age** — this is how you catch a
  verdict resting on stale news
- A receipt for each miner payment, linking to Basescan

Share it with **Copy link** or **Post**. The link preview carries the verdict,
so it says something before anyone clicks. This is the page you drop into an
argument.

---

## `/pulse` — Which miners actually work

Live health for every miner in the Telegraph catalog. Two separate columns, and
the difference between them is the whole point:

| Column | Means |
|---|---|
| **Routable** | The node still dispatches to this miner. Free to check. |
| **Live** | The service behind it actually answered when paid. |

A miner can be **routable 100% and live 50%**. That gap is invisible to anyone
who has not paid for calls, and it is why one number would not do.

States: **healthy** (≥80% live), **degraded**, **down**, **unproven** (routable
but never paid-tested — we will not claim it works).

**If you run a miner:** press **copy md** on your row and paste it into your
README:

```markdown
![Telegraph miner 202](https://usexyle.vercel.app/badge/202.svg)
```

It updates itself. Machine-readable feed at `GET /api/pulse`.

---

## `/calibration` — Is the confidence number real?

An oracle claiming "88% confident" should be right about 88% of the time. This
page checks that against every settled market.

- **Accuracy** — how often the settling verdict matched the outcome
- **Brier score** — lower is better; 0.25 is what you would score by always
  saying 50%
- **Over/underconfident by** — the gap between claimed and actual

Uncertain verdicts are excluded, because a reading that asserted nothing cannot
be graded. Bands with fewer than five predictions are noise; the page says so.

Published whether or not it flatters us. An oracle asking for trust should show
this before anyone thinks to ask.

---

## `/ledger` — Every call, every cent

The public record of what this app has spent on Telegraph miners: who was
called, how long it took, what it cost, and the transaction receipt.

Search by miner, role, or receipt hash. Filter to **Failed** to see which miners
are unreliable — failed calls cost nothing but are kept as reliability data.

This is the demand scoreboard. If you operate a miner, your traffic from us is
in here.

---

## `/markets` — Forecasts that settle themselves

A market is a yes/no question with a deadline. Nobody resolves it by hand.

1. **Open one** by pasting a headline, or wait for the hourly cron to open one
   from live news.
2. **Call it** YES or NO. One call per wallet; you can change it while the
   market is open. Requires sign-in.
3. **Readings** run automatically, or press **Run the oracle**.

A market settles **YES** only when both judges agree, confidence clears the bar,
authenticity is clean, and fresh sources exist. It settles **NO** when the
deadline passes without confirmation.

A `no` verdict does **not** settle a market. It means "not yet" — the thing
could still happen before the deadline. This confuses people, so the market page
now spells it out under each reading.

---

## `/challenge` — Break it

Linked in the nav as **Break it**. Same four-stage pipeline as `/verify`, used
with the opposite intent:

| | `/verify` | `/challenge` |
|---|---|---|
| You want | The truth about a claim | To catch the oracle being wrong |
| A good input | Something you actually want checked | Something false but convincing |
| You get | A citable permalink | A fool score, and a break if you succeed |
| Ideal result | Whatever is true | A confident YES on something false |

Try to fool the oracle. Write a claim convincing enough to push it toward a
false YES.

Your **fool score** rises the closer you get. A **break** needs both judges to
say yes above the confidence bar — genuinely hard, and worth publishing when it
happens.

The **Hall of breaks** is a public red-team set: claims that beat a consensus
oracle. That dataset is useful well beyond this app.

---

## `/desk` — Your account

Requires connecting a wallet and signing in. The wallet is **identity only** —
it never pays for anything. Miner fees always come from the app's own wallet.

- **Handle** — shown on the leaderboard and share cards
- **Watchlist** — markets you follow, plus keyword matches
- **Alerts** — in-app notifications when watched markets settle
- **Personal webhook** — one URL, POSTed when a watched market settles
- **Agents** — named callbacks, same trigger, each tagged with its own id

Press **⚡ Send test event** to check an endpoint immediately rather than waiting
hours for a real settlement. Paste a [webhook.site](https://webhook.site) URL to
try it in thirty seconds.

**Discord and Slack URLs are detected automatically** and sent in their native
format, so you can paste the webhook your community already uses.

---

## `/leaderboard`

Ranked by how often your calls were right, not by an invented balance. Weighted
so a steady 18-for-20 beats a lucky 1-for-1. Break-it attempts count too.

---

## For developers

### HTTP

```bash
curl -X POST https://usexyle.vercel.app/api/oracle/verify \
  -H "content-type: application/json" \
  -d '{"claim":"..."}'
```

Returns `{ id, permalink, result }`. Full docs at `GET /api/oracle/verify`.

### MCP

Point any MCP client at the server so your agent can check a claim before acting
on it:

```json
{ "mcpServers": { "xyle": { "url": "https://usexyle.vercel.app/api/mcp" } } }
```

Tools: `verify_claim`, `get_miner_health`, `get_claim`.

Treat an `uncertain` verdict as **do not act**. That is the whole point of a
guardrail: it refuses rather than guessing.

### Webhooks

Signed with `X-Xyle-Signature: sha256=<hmac>` over the raw body. Callback URLs
must be https and publicly resolvable — loopback and private ranges are rejected
at registration and again at delivery, because the server fetches them.
