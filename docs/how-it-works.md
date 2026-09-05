---
title: How it works
summary: What Xyle actually does, who it is for, and an honest account of where it wins and where a search engine beats it.
order: 1
---

# How it works

Xyle answers one question: **is this claim actually true, right now?**

You give it a sentence. Four independent AI miners on the Telegraph network go
and check, each paid a fraction of a cent on-chain. You get back a verdict, the
dated sources it relied on, and a receipt for every payment.

If the evidence is not there, it says so instead of guessing.

---

## Meet Dayo

Dayo runs a small DeFi insurance pool. Members pay in; if a protocol they hold
funds in gets exploited, they get paid out.

His problem is not writing the payout logic. It is this:

> **Who decides an exploit actually happened?**

Today, he does. Someone opens a claim, Dayo spends an hour reading Twitter
threads and half-confirmed reports, then decides. That is slow, it does not
scale past a handful of claims, and when he gets it wrong the members who lost
money have no way to check his reasoning.

He also cannot do it at 3am, which is when exploits happen.

### What Dayo does instead

He wires his payout contract to Xyle:

```bash
curl -X POST https://usexyle.vercel.app/api/oracle/verify \
  -H "content-type: application/json" \
  -d '{"claim":"The Ostium protocol was exploited for more than $10 million in the past week"}'
```

Forty seconds and about four cents later:

```json
{
  "verdict": "yes",
  "confidence": 0.88,
  "permalink": "https://usexyle.vercel.app/c/c_8fk2n1",
  "sources": [
    { "title": "Ostium Confirms $23.75M Hack...", "publishedAt": "2026-07-30" }
  ]
}
```

Now three things are true that were not before:

1. **It happened without him.** His contract called it, at 3am, unprompted.
2. **The reasoning is public.** That permalink shows the sources with their
   dates, both judges' independent votes, and the on-chain receipts. A member
   who disputes the payout can read exactly what was consulted.
3. **It scales.** The hundredth claim costs the same four cents as the first.

### The part that matters most

A week later a member files a claim citing a *nine-month-old* Balancer exploit,
hoping nobody checks the date.

Xyle returns **no**, and says why:

> The most recent supporting coverage is from November 2025, outside the 7 day
> window. The claim is not established.

Dayo's old process might have missed that. The oracle refuses by default when
the evidence does not hold, which for anything touching money is the behaviour
you want.

---

## How a verdict is built

Every check buys four stages from four **different** Telegraph miners:

| Stage | Question it answers |
|---|---|
| **Evidence** | What has actually been published about this, in the last few days? |
| **Authenticity** | Does that coverage read like real reporting or generated wire copy? |
| **Judge A** | Given the dated evidence, did this happen? |
| **Judge B** | Independently: did this happen? |

A claim is only confirmed when **both judges agree**, confidence clears the
bar, the authenticity check has not flagged the coverage as synthetic, and
corroborating sources exist inside the freshness window.

Any of those failing produces `uncertain`, not a guess.

### Why four, and why separate

If one model both gathers evidence and rules on it, there is nothing to catch
its mistake. Splitting the roles means a failure has to get past two
independent judges plus a synthetic-text detector.

Being honest about the limit: four language models share training data and
failure modes. When they agree, that is correlated agreement, not four truly
independent observers. Two judges *disagreeing* is strong information; two
agreeing is weaker than it looks. Which is why the confidence number is
published and graded on the [calibration](/calibration) page rather than
asserted.

### When a stage fails

Free-tier miners rate-limit constantly. Measured on this deployment, the judge
miners run at roughly 82% and 88% success.

So the pipeline degrades instead of collapsing:

- Evidence miner down → falls back to a second search miner
- Authenticity miner down → falls back to a local heuristic, flagged as degraded
- One judge down → tries a different backup miner; if that fails too, consensus
  is impossible and the verdict cannot be `yes`

Every reading reports which stages actually ran. A degraded reading can never
confirm a claim.

---

## Where this genuinely wins

**When nobody is watching.** A search engine needs a human to type, read, and
judge. Xyle runs on a schedule and pushes a signed webhook the moment something
resolves. You are not asking "did X happen" — you are saying "tell my code when
it does".

**At volume.** One claim: use Google. Five hundred claims a day — insurance
triggers, DAO milestones, bounty conditions, moderation appeals — and no human
keeps up. At four cents each, five hundred verdicts cost twenty dollars.

**When the answer has consequences.** If a verdict releases money, "I searched
and it looked true" is not defensible. Xyle produces sources with dates, both
judges' votes, and payment receipts anyone can replay.

**When you do not trust the asker.** Search assumes good faith. Xyle assumes the
input might be manufactured, which is why the authenticity stage and the whole
[adversary mode](/challenge) exist.

## Where it does not

Said plainly, because a tool that claims to beat everything is not credible:

- **A single question is faster on Google.** Permanently. That is the shape of
  the tool, not a bug to fix.
- **It cannot verify what the press has not covered.** No coverage, no verdict.
  That is most of the world.
- **It is biased toward refusing.** Every guard pushes toward `uncertain`. Safe
  for money, frustrating if you just wanted an answer.
- **Consensus is correlated.** See above.

---

## The side effect nobody expected

Xyle pays real miners for real work, thousands of times. Doing that produced
something the ecosystem did not have: **a measured record of which parts of
Telegraph actually function.**

Miner 109 advertised itself as available for weeks while its upstream quota was
exhausted. Miner 202 currently answers routing checks perfectly and fails half
of real paid calls. The published catalog says miner 110 accepts only free
models; it does not.

None of that is discoverable without paying. It is all on [Pulse](/pulse), and
miner operators can embed their own live status badge.

That is the part builders keep coming back for.
