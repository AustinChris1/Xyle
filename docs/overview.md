---
title: Overview
summary: What Xyle is, who it is for, and where to go next.
order: 0
---

# Xyle

**A verifiable multi-miner oracle built on [Telegraph Protocol](https://telegraphprotocol.com).** You give it a factual claim. It pays four independent miners to check that claim, makes them agree before it will say yes, and hands you a permanent page showing every source, every judge, and every payment receipt.

The point is not that a model answered. The point is that you can check the answer.

---

## The problem

Ask any chatbot whether something happened and you get a confident paragraph. You cannot tell whether it read a news article from this morning, hallucinated it, or repeated something from two years ago. There is no source list, no timestamp, no second opinion, and no record afterward.

That is fine for trivia and unacceptable the moment money, safety, or reputation depends on the answer.

---

## What Xyle does differently

| | A chatbot | Xyle |
|---|---|---|
| Who answers | One model | Four independent miners |
| Agreement | Not applicable | Two judges must agree, or the verdict is withheld |
| Sources | Often none | Listed with publication dates and ages |
| Freshness | Unknown | Stale evidence is rejected at the code level |
| Afterwards | A chat log | A permanent, citable page |
| Cost | Hidden | Every miner payment has an on-chain receipt |

The most important row is the second one. When the two judges disagree, Xyle does not average them or pick the confident one. It returns **uncertain**, which means *do not act on this*. An oracle that refuses to answer is more useful than one that guesses.

---

## Where to go next

**[How it works](./how-it-works.md)** follows one real user through a real decision and explains what each of the four stages actually buys. Start here if you want to know whether this is useful to you.

**[Usage](./usage.md)** is the page-by-page guide to the app: what each screen is for and what to click.

**[Architecture](./architecture.md)** is the internals: modules, data flow, persistence, and how failures are handled.

**[Keys](./keys.md)** covers wallets, the payment network, and funding a test wallet.

---

## Try it in one minute

1. Go to **[Verify](/verify)**.
2. Paste a factual claim about something recent. Specific beats vague.
3. Wait about forty seconds while the four stages run.
4. You land on a permanent link showing the verdict, the dated sources, both judges, and the receipts.

You pay nothing. The app spends its own USDC on the miners, and that spend is public on the **[Ledger](/ledger)**.

---

## Honest limits

Worth knowing before you rely on it:

- **It is only as good as the press.** If nobody has reported something, Xyle cannot confirm it, and it will say so rather than guess.
- **It runs on a testnet.** Payments are Base Sepolia USDC, not real money.
- **Miners fail.** Free-tier upstreams hit quotas and go down. When a stage fails, the reading degrades and is marked, and it never settles yes on incomplete consensus. **[Pulse](/pulse)** shows which miners are actually working right now.
- **Confidence is a claim, not a fact.** So it is scored publicly on **[Calibration](/calibration)**, whether or not the numbers flatter us.
