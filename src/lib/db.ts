import { loadConfig } from "./config";
import {
  backendLabel,
  emptyStore,
  loadPersisted,
  queueSave,
  type PersistedStore,
} from "./persist";
import type {
  ActivityItem,
  ChallengeAttempt,
  ConsumptionEntry,
  LeaderboardEntry,
  Market,
  OracleTick,
  Stake,
} from "./types";

const globalForDb = globalThis as unknown as {
  __signalArenaStore?: PersistedStore;
  __signalArenaReady?: Promise<void>;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function ensureReady() {
  if (!globalForDb.__signalArenaReady) {
    globalForDb.__signalArenaReady = (async () => {
      const loaded = await loadPersisted();
      globalForDb.__signalArenaStore = loaded;
      if (!loaded.seeded) {
        seed(loaded);
        loaded.seeded = true;
        loaded.seedVersion = SEED_VERSION;
        await queueSave(loaded);
      } else if ((loaded.seedVersion ?? 0) < SEED_VERSION) {
        refreshSeeds(loaded);
        loaded.seedVersion = SEED_VERSION;
        await queueSave(loaded);
      }
    })();
  }
  await globalForDb.__signalArenaReady;
}

function store(): PersistedStore {
  if (!globalForDb.__signalArenaStore) {
    globalForDb.__signalArenaStore = emptyStore();
  }
  return globalForDb.__signalArenaStore;
}

function persist() {
  void queueSave(store());
}

const SEED_VERSION = 2;

type SeedMarket = Omit<
  Market,
  "id" | "createdAt" | "potYes" | "potNo" | "status"
>;

function seedMarkets(): SeedMarket[] {
  const cfg = loadConfig();
  const now = Date.now();
  return [
    {
      title: "Will a major DeFi protocol exploit be confirmed in the next 48 hours?",
      description:
        "Settles YES when independent coverage of a real exploit holds up under an authenticity check. Recycled rumours and synthetic wire copy do not count.",
      eventClass: "defi_exploit",
      searchQuery: "DeFi protocol exploit hack vulnerability drained funds",
      confidenceThreshold: cfg.defaultConfidence,
      closesAt: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: "Will a major airport hub see mass flight cancellations today?",
      description:
        "Settles YES when several outlets report cancellations cascading through a major hub, after rumour posts have been filtered out.",
      eventClass: "flight_disruption",
      searchQuery: "airport mass flight cancellations delay hub airlines",
      confidenceThreshold: 0.68,
      closesAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: "Will a trending crypto claim be contradicted by independent reporting?",
      description:
        "Settles YES when a viral raise, partnership, or hack claim is publicly contradicted by reporting that passes the authenticity check.",
      eventClass: "claim_contradiction",
      searchQuery: "crypto project scam fake raise partnership denied",
      confidenceThreshold: 0.7,
      closesAt: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function seed(s: PersistedStore) {
  for (const item of seedMarkets()) {
    s.markets.push({
      id: uid("mkt"),
      potYes: 0,
      potNo: 0,
      status: "open",
      createdAt: new Date().toISOString(),
      source: "seed",
      ...item,
    });
  }
}

/**
 * Replaces demo markets whose copy went stale, but only the untouched ones.
 * Anything with a position or a reading against it is left exactly as is.
 */
function refreshSeeds(s: PersistedStore) {
  const classes = new Set(seedMarkets().map((m) => m.eventClass));
  const touched = (id: string) =>
    s.stakes.some((x) => x.marketId === id) ||
    s.ticks.some((x) => x.marketId === id);

  s.markets = s.markets.filter(
    (m) => !classes.has(m.eventClass) || touched(m.id)
  );

  const remaining = new Set(s.markets.map((m) => m.eventClass));
  for (const item of seedMarkets()) {
    if (remaining.has(item.eventClass)) continue;
    s.markets.push({
      id: uid("mkt"),
      potYes: 0,
      potNo: 0,
      status: "open",
      createdAt: new Date().toISOString(),
      source: "seed",
      ...item,
    });
  }
}

export const db = {
  backend: () => backendLabel(),

  async listMarkets(): Promise<Market[]> {
    await ensureReady();
    return [...store().markets].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getMarket(id: string): Promise<Market | undefined> {
    await ensureReady();
    return store().markets.find((m) => m.id === id);
  },

  async createMarket(input: {
    title: string;
    description: string;
    eventClass: string;
    searchQuery: string;
    confidenceThreshold?: number;
    closesInHours?: number;
    source?: Market["source"];
    sourceHeadline?: string;
  }): Promise<Market> {
    await ensureReady();
    const cfg = loadConfig();
    const hours = input.closesInHours ?? 48;
    const market: Market = {
      id: uid("mkt"),
      title: input.title,
      description: input.description,
      eventClass: input.eventClass,
      searchQuery: input.searchQuery,
      confidenceThreshold: input.confidenceThreshold ?? cfg.defaultConfidence,
      potYes: 0,
      potNo: 0,
      status: "open",
      closesAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      source: input.source ?? "user",
      sourceHeadline: input.sourceHeadline,
    };
    store().markets.unshift(market);
    await this.pushActivity({
      kind: input.source === "auto" ? "auto_market" : "market_opened",
      title: market.title,
      detail: market.sourceHeadline || market.eventClass,
      href: `/markets/${market.id}`,
    });
    return market;
  },

  async updateMarket(
    id: string,
    patch: Partial<Market>
  ): Promise<Market | undefined> {
    await ensureReady();
    const m = store().markets.find((x) => x.id === id);
    if (!m) return undefined;
    Object.assign(m, patch);
    persist();
    return m;
  },

  async listStakes(marketId?: string): Promise<Stake[]> {
    await ensureReady();
    const all = store().stakes;
    return marketId ? all.filter((s) => s.marketId === marketId) : [...all];
  },

  async addStake(input: {
    marketId: string;
    player: string;
    side: "yes" | "no";
    amount: number;
  }): Promise<Stake> {
    await ensureReady();
    const market = store().markets.find((m) => m.id === input.marketId);
    if (!market) throw new Error("MARKET_NOT_FOUND");
    if (market.status !== "open") throw new Error("MARKET_CLOSED");
    if (new Date(market.closesAt).getTime() < Date.now()) {
      market.status = "expired";
      persist();
      throw new Error("MARKET_EXPIRED");
    }
    if (input.amount <= 0 || input.amount > 100) throw new Error("INVALID_AMOUNT");

    const stake: Stake = {
      id: uid("stk"),
      marketId: input.marketId,
      player: input.player.trim().slice(0, 32) || "anon",
      side: input.side,
      amount: Math.round(input.amount * 100) / 100,
      createdAt: new Date().toISOString(),
    };
    store().stakes.push(stake);
    if (stake.side === "yes") market.potYes += stake.amount;
    else market.potNo += stake.amount;
    persist();
    return stake;
  },

  async listTicks(marketId?: string): Promise<OracleTick[]> {
    await ensureReady();
    const all = store().ticks;
    const filtered = marketId
      ? all.filter((t) => t.marketId === marketId)
      : [...all];
    return filtered.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  },

  async addTick(tick: Omit<OracleTick, "id">): Promise<OracleTick> {
    await ensureReady();
    const full: OracleTick = { ...tick, id: uid("tick") };
    store().ticks.unshift(full);
    // keep last 200 ticks
    if (store().ticks.length > 200) store().ticks.length = 200;
    persist();
    return full;
  },

  async patchTick(
    id: string,
    patch: Partial<OracleTick>
  ): Promise<OracleTick | undefined> {
    await ensureReady();
    const t = store().ticks.find((x) => x.id === id);
    if (!t) return undefined;
    Object.assign(t, patch);
    persist();
    return t;
  },

  async addChallenge(
    attempt: Omit<ChallengeAttempt, "id">
  ): Promise<ChallengeAttempt> {
    await ensureReady();
    const full: ChallengeAttempt = { ...attempt, id: uid("chal") };
    store().challenges.unshift(full);
    if (store().challenges.length > 300) store().challenges.length = 300;
    persist();
    return full;
  },

  async listChallenges(): Promise<ChallengeAttempt[]> {
    await ensureReady();
    return [...store().challenges].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async recordMinerRequests(n: number) {
    await ensureReady();
    store().minerRequests += n;
    persist();
  },

  async minerRequests(): Promise<number> {
    await ensureReady();
    return store().minerRequests;
  },

  async totalCostUsdc(): Promise<number> {
    await ensureReady();
    return Math.round((store().totalCostUsdc || 0) * 10000) / 10000;
  },

  /**
   * Appends one ledger row. Called from the miner client the instant a call
   * resolves, so spend is recorded even when the reading later fails.
   */
  async recordCall(input: Omit<ConsumptionEntry, "id" | "at">) {
    await ensureReady();
    const s = store();
    if (!s.consumption) s.consumption = [];
    if (!s.totalCostUsdc) s.totalCostUsdc = 0;

    s.consumption.unshift({
      ...input,
      id: uid("cns"),
      at: new Date().toISOString(),
    });
    s.totalCostUsdc += input.costUsdc;
    s.minerRequests += 1;

    if (s.consumption.length > 500) s.consumption.length = 500;
    persist();
  },

  /** Rolling-window spend, used to cap the public verify endpoint. */
  async spendSince(sinceMs: number): Promise<number> {
    await ensureReady();
    const cutoff = Date.now() - sinceMs;
    let total = 0;
    for (const c of store().consumption || []) {
      if (new Date(c.at).getTime() >= cutoff) total += c.costUsdc;
    }
    return Math.round(total * 10000) / 10000;
  },

  async listConsumption(limit = 100): Promise<ConsumptionEntry[]> {
    await ensureReady();
    return [...(store().consumption || [])].slice(0, limit);
  },

  async consumptionByMiner(): Promise<
    Array<{ minerId: string; calls: number; costUsdc: number }>
  > {
    await ensureReady();
    const map = new Map<string, { minerId: string; calls: number; costUsdc: number }>();
    for (const c of store().consumption || []) {
      const cur = map.get(c.minerId) || {
        minerId: c.minerId,
        calls: 0,
        costUsdc: 0,
      };
      cur.calls += 1;
      cur.costUsdc += c.costUsdc;
      map.set(c.minerId, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        costUsdc: Math.round(r.costUsdc * 10000) / 10000,
      }))
      .sort((a, b) => b.calls - a.calls);
  },

  async pushActivity(item: Omit<ActivityItem, "id" | "at">) {
    await ensureReady();
    const s = store();
    if (!s.activity) s.activity = [];
    s.activity.unshift({
      ...item,
      id: uid("act"),
      at: new Date().toISOString(),
    });
    if (s.activity.length > 100) s.activity.length = 100;
    persist();
  },

  async listActivity(limit = 30): Promise<ActivityItem[]> {
    await ensureReady();
    return [...(store().activity || [])].slice(0, limit);
  },

  async hallOfBreaks(limit = 20): Promise<ChallengeAttempt[]> {
    await ensureReady();
    return [...store().challenges]
      .filter((c) => c.brokeThreshold)
      .sort((a, b) => b.foolScore - a.foolScore)
      .slice(0, limit);
  },

  async setLastCronAt(iso: string) {
    await ensureReady();
    store().lastCronAt = iso;
    persist();
  },

  async lastCronAt(): Promise<string | undefined> {
    await ensureReady();
    return store().lastCronAt;
  },

  async leaderboard(): Promise<LeaderboardEntry[]> {
    await ensureReady();
    const map = new Map<string, LeaderboardEntry>();
    const ensure = (player: string) => {
      if (!map.has(player)) {
        map.set(player, {
          player,
          stakeWins: 0,
          stakePnL: 0,
          challengeBest: 0,
          challengeCount: 0,
          totalScore: 0,
        });
      }
      return map.get(player)!;
    };

    for (const market of store().markets) {
      if (market.status !== "settled_yes" && market.status !== "settled_no")
        continue;
      const winSide = market.status === "settled_yes" ? "yes" : "no";
      const winPot = winSide === "yes" ? market.potYes : market.potNo;
      const losePot = winSide === "yes" ? market.potNo : market.potYes;
      const stakes = store().stakes.filter((s) => s.marketId === market.id);
      for (const s of stakes) {
        const e = ensure(s.player);
        if (s.side === winSide) {
          e.stakeWins += 1;
          const share =
            winPot > 0 ? (s.amount / winPot) * (winPot + losePot) : 0;
          e.stakePnL += share - s.amount;
        } else {
          e.stakePnL -= s.amount;
        }
      }
    }

    for (const c of store().challenges) {
      const e = ensure(c.player);
      e.challengeCount += 1;
      e.challengeBest = Math.max(e.challengeBest, c.foolScore);
    }

    for (const e of map.values()) {
      e.totalScore =
        e.stakeWins * 100 +
        e.stakePnL * 10 +
        e.challengeBest * 500 +
        e.challengeCount * 5;
      e.stakePnL = Math.round(e.stakePnL * 100) / 100;
      e.totalScore = Math.round(e.totalScore * 10) / 10;
    }

    return [...map.values()].sort((a, b) => b.totalScore - a.totalScore);
  },

  async openMarketIds(): Promise<string[]> {
    await ensureReady();
    return store()
      .markets.filter((m) => m.status === "open")
      .map((m) => m.id);
  },
};
