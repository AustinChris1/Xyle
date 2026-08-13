import { loadConfig } from "./config";
import {
  backendLabel,
  emptyStore,
  flushSaves,
  loadPersisted,
  queueSave,
  type PersistedStore,
} from "./persist";
import type {
  ActivityItem,
  Agent,
  ChallengeAttempt,
  ConsumptionEntry,
  LeaderboardEntry,
  Market,
  MinerHealth,
  MinerProbe,
  OracleTick,
  Forecast,
  StoredClaim,
  UserAlert,
  UserProfile,
} from "./types";

const globalForDb = globalThis as unknown as {
  __xyleStore?: PersistedStore;
  __xyleReady?: Promise<void>;
  __xyleReloadedAt?: number;
  __xyleReloading?: Promise<void>;
};

/** How often a cache miss is allowed to re-read the store. See reloadStore. */
const RELOAD_THROTTLE_MS = 750;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function ensureReady() {
  if (!globalForDb.__xyleReady) {
    globalForDb.__xyleReady = (async () => {
      const loaded = await loadPersisted();
      globalForDb.__xyleStore = loaded;
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
  await globalForDb.__xyleReady;
}

/**
 * Drops the cached store and reads it back from the database.
 *
 * The store is loaded once per instance and held in a module global, which is
 * what makes every other read free. The cost is that a warm instance never sees
 * writes made by a different one, so only the paths where that staleness is
 * user-visible pay for a reload.
 *
 * Pending writes are flushed first: the queue holds a reference to the current
 * store object, and swapping it out with a save still queued would write the
 * old snapshot over newer data.
 */
async function reloadStore() {
  // Callers reload on a cache miss, and a miss is also what a bogus id
  // produces, so this needs a guard against unbounded reads. It has to stay
  // short: the permalink is opened about a second after the write, and a
  // reload skipped in that window is the 404 this exists to prevent.
  //
  // What it actually collapses is the burst. /c/[id] asks twice per render
  // (generateMetadata, then the page body) milliseconds apart, and concurrent
  // requests share the in-flight read rather than each issuing their own.
  const now = Date.now();
  if (now - (globalForDb.__xyleReloadedAt ?? 0) < RELOAD_THROTTLE_MS) {
    await globalForDb.__xyleReloading;
    return;
  }
  globalForDb.__xyleReloadedAt = now;

  globalForDb.__xyleReloading = (async () => {
    await flushSaves();
    globalForDb.__xyleReady = undefined;
    globalForDb.__xyleStore = undefined;
    await ensureReady();
  })();

  await globalForDb.__xyleReloading;
}

function store(): PersistedStore {
  if (!globalForDb.__xyleStore) {
    globalForDb.__xyleStore = emptyStore();
  }
  return globalForDb.__xyleStore;
}

function persist() {
  void queueSave(store());
}

/** potYes / potNo are forecaster counts now, so recompute them from scratch. */
function recountMarket(market: Market) {
  const forecasts = store().stakes.filter((f) => f.marketId === market.id);
  market.potYes = forecasts.filter((f) => f.side === "yes").length;
  market.potNo = forecasts.filter((f) => f.side === "no").length;
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
    createdBy?: string;
    createdByHandle?: string;
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
      createdBy: input.createdBy?.toLowerCase(),
      createdByHandle: input.createdByHandle,
    };
    store().markets.unshift(market);
    await this.pushActivity({
      kind: input.source === "auto" ? "auto_market" : "market_opened",
      title: market.title,
      detail: market.sourceHeadline || market.eventClass,
      href: `/markets/${market.id}`,
      marketId: market.id,
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

  async listStakes(marketId?: string): Promise<Forecast[]> {
    await ensureReady();
    const all = store().stakes;
    return marketId ? all.filter((s) => s.marketId === marketId) : [...all];
  },

  /**
   * Records one forecast per wallet per market. Calling again replaces the
   * previous call, so people can change their mind while a market is open
   * without inflating the counts.
   *
   * potYes / potNo now hold counts of forecasters rather than wagered
   * amounts, so the split bar reads as how many people say YES.
   */
  async addForecast(input: {
    marketId: string;
    player: string;
    address: string;
    side: "yes" | "no";
  }): Promise<Forecast> {
    await ensureReady();
    const market = store().markets.find((m) => m.id === input.marketId);
    if (!market) throw new Error("MARKET_NOT_FOUND");
    if (market.status !== "open") throw new Error("MARKET_CLOSED");
    if (new Date(market.closesAt).getTime() < Date.now()) {
      market.status = "expired";
      persist();
      throw new Error("MARKET_EXPIRED");
    }

    const address = input.address.toLowerCase();
    const all = store().stakes;
    const existingIndex = all.findIndex(
      (f) => f.marketId === input.marketId && f.address === address
    );

    const forecast: Forecast = {
      id: existingIndex >= 0 ? all[existingIndex]!.id : uid("fc"),
      marketId: input.marketId,
      player: input.player.trim().slice(0, 32) || "anon",
      address,
      side: input.side,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) all[existingIndex] = forecast;
    else all.push(forecast);

    recountMarket(market);
    persist();
    return forecast;
  },

  async getForecast(
    marketId: string,
    address?: string
  ): Promise<Forecast | undefined> {
    if (!address) return undefined;
    await ensureReady();
    const a = address.toLowerCase();
    return store().stakes.find(
      (f) => f.marketId === marketId && f.address === a
    );
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
    const full: ChallengeAttempt = {
      ...attempt,
      id: uid("chal"),
      address: attempt.address?.toLowerCase(),
    };
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

  /**
   * Stores a verification so it can be linked at /c/[id].
   * Capped, oldest dropped, since the store is one JSON blob.
   */
  async saveClaim(input: Omit<StoredClaim, "id" | "at">): Promise<StoredClaim> {
    await ensureReady();
    const s = store();
    if (!s.claims) s.claims = [];
    const claim: StoredClaim = {
      ...input,
      id: uid("c"),
      at: new Date().toISOString(),
    };
    s.claims.unshift(claim);
    if (s.claims.length > 500) s.claims.length = 500;
    // Awaited, not fire-and-forget. Every caller hands the id straight back to
    // a client that immediately navigates to /c/<id>, which is served by a
    // different serverless instance reading from the database. If this write is
    // still queued when the function freezes, the permalink 404s.
    persist();
    await flushSaves();
    return claim;
  },

  async getClaim(id: string): Promise<StoredClaim | undefined> {
    await ensureReady();
    const hit = (store().claims || []).find((c) => c.id === id);
    if (hit) return hit;

    // A permalink is normally opened a second after the claim was written, and
    // often by a different instance whose store predates that write. A miss
    // here is not proof of absence, so reload once before returning nothing.
    // Without this the page 404s on a verification that plainly succeeded.
    await reloadStore();
    return (store().claims || []).find((c) => c.id === id);
  },

  async listClaims(limit = 50): Promise<StoredClaim[]> {
    await ensureReady();
    return [...(store().claims || [])].slice(0, limit);
  },

  async recordProbes(probes: MinerProbe[]) {
    await ensureReady();
    const s = store();
    if (!s.probes) s.probes = [];
    s.probes.unshift(...probes);
    // Roughly a week of hourly probes across the catalog.
    if (s.probes.length > 4000) s.probes.length = 4000;
    persist();
  },

  /**
   * Rolling health per miner.
   *
   * Two independent signals, because they answer different questions:
   * routability (free 402 checks) says the node still dispatches to a miner;
   * liveness (paid probes plus real app traffic) says the upstream behind it
   * actually answers. Miner 109 was routable for weeks while its Gemini quota
   * was exhausted, so collapsing these into one number would have hidden it.
   */
  async minerHealth(
    catalog: Array<{ id: string; slug: string; name: string; kind: string }>
  ): Promise<MinerHealth[]> {
    await ensureReady();
    const s = store();
    const probes = s.probes || [];
    const ledger = s.consumption || [];

    const byId = new Map<string, MinerHealth>();
    for (const c of catalog) {
      byId.set(String(c.id), {
        minerId: String(c.id),
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        routableProbes: 0,
        routableOk: 0,
        routableUptime: 0,
        liveProbes: 0,
        liveOk: 0,
        liveUptime: 0,
        p50LatencyMs: 0,
        paidCalls: 0,
        paidFailures: 0,
        state: "unknown",
      });
    }

    const latencies = new Map<string, number[]>();

    for (const p of probes) {
      const h = byId.get(p.minerId);
      if (!h) continue;

      if (p.paid) {
        h.liveProbes += 1;
        if (p.ok) h.liveOk += 1;
      } else {
        h.routableProbes += 1;
        if (p.ok) h.routableOk += 1;
      }

      if (p.ok) {
        if (!h.lastOk || p.at > h.lastOk) h.lastOk = p.at;
        if (p.paid) {
          const arr = latencies.get(p.minerId) || [];
          arr.push(p.latencyMs);
          latencies.set(p.minerId, arr);
        }
      } else {
        if (!h.lastFail || p.at > h.lastFail) {
          h.lastFail = p.at;
          h.lastError = p.error || `HTTP ${p.status ?? "?"}`;
        }
      }
    }

    // Real traffic is the strongest liveness evidence we have.
    for (const c of ledger) {
      const h = byId.get(c.minerId);
      if (!h) continue;
      h.paidCalls += 1;
      h.liveProbes += 1;
      if (c.success) {
        h.liveOk += 1;
        const arr = latencies.get(c.minerId) || [];
        arr.push(c.latencyMs);
        latencies.set(c.minerId, arr);
      } else {
        h.paidFailures += 1;
        if (!h.lastFail || c.at > h.lastFail) h.lastFail = c.at;
      }
    }

    for (const h of byId.values()) {
      h.routableUptime =
        h.routableProbes > 0 ? h.routableOk / h.routableProbes : 0;
      h.liveUptime = h.liveProbes > 0 ? h.liveOk / h.liveProbes : 0;

      const arr = (latencies.get(h.minerId) || []).sort((a, b) => a - b);
      h.p50LatencyMs = arr.length ? arr[Math.floor(arr.length / 2)]! : 0;

      if (h.liveProbes >= 2) {
        h.state =
          h.liveUptime >= 0.8
            ? "healthy"
            : h.liveUptime > 0
              ? "degraded"
              : "down";
      } else if (h.routableProbes > 0) {
        // Routable but unproven: the best we can honestly say.
        h.state = h.routableUptime >= 0.5 ? "unknown" : "down";
      } else {
        h.state = "unknown";
      }
    }

    return [...byId.values()];
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

  /** Awaited: this is the final write of a cron cycle, so a fire-and-forget
   *  save would be dropped when the function freezes. */
  async setLastCronAt(iso: string) {
    await ensureReady();
    store().lastCronAt = iso;
    persist();
    await flushSaves();
  },

  async lastCronAt(): Promise<string | undefined> {
    await ensureReady();
    return store().lastCronAt;
  },

  /**
   * Ranks by how often people were right, not by an invented balance.
   * Accuracy is the honest score for a forecasting product and stays
   * meaningful whether someone made three calls or thirty.
   */
  async leaderboard(): Promise<LeaderboardEntry[]> {
    await ensureReady();
    const map = new Map<string, LeaderboardEntry>();
    const ensure = (player: string) => {
      if (!map.has(player)) {
        map.set(player, {
          player,
          resolved: 0,
          correct: 0,
          accuracy: 0,
          pending: 0,
          challengeBest: 0,
          challengeCount: 0,
          totalScore: 0,
        });
      }
      return map.get(player)!;
    };

    const marketById = new Map(store().markets.map((m) => [m.id, m]));

    for (const f of store().stakes) {
      const market = marketById.get(f.marketId);
      if (!market) continue;
      const e = ensure(f.player);

      if (market.status === "settled_yes" || market.status === "settled_no") {
        const winSide = market.status === "settled_yes" ? "yes" : "no";
        e.resolved += 1;
        if (f.side === winSide) e.correct += 1;
      } else {
        e.pending += 1;
      }
    }

    for (const c of store().challenges) {
      const e = ensure(c.player);
      e.challengeCount += 1;
      e.challengeBest = Math.max(e.challengeBest, c.foolScore);
    }

    for (const e of map.values()) {
      e.accuracy = e.resolved > 0 ? e.correct / e.resolved : 0;
      // Accuracy alone would rank a lucky 1-for-1 above a steady 18-for-20,
      // so weight it by how many calls actually resolved.
      const forecasting = e.correct * 40 + e.accuracy * 60;
      e.totalScore =
        Math.round(
          (forecasting + e.challengeBest * 200 + e.challengeCount * 5) * 10
        ) / 10;
    }

    return [...map.values()].sort((a, b) => b.totalScore - a.totalScore);
  },

  async openMarketIds(): Promise<string[]> {
    await ensureReady();
    return store()
      .markets.filter((m) => m.status === "open")
      .map((m) => m.id);
  },

  // ── SIWE profiles ──────────────────────────────────────────────

  async ensureUser(address: string, handleHint?: string): Promise<UserProfile> {
    await ensureReady();
    const key = address.toLowerCase();
    const s = store();
    if (!s.users) s.users = {};
    const existing = s.users[key];
    if (existing) return existing;
    const now = new Date().toISOString();
    const short = `${key.slice(0, 6)}…${key.slice(-4)}`;
    const profile: UserProfile = {
      address: key,
      handle: (handleHint || short).slice(0, 32),
      createdAt: now,
      updatedAt: now,
      watchlistMarketIds: [],
      watchlistKeywords: [],
      agents: [],
      alerts: [],
    };
    s.users[key] = profile;
    persist();
    return profile;
  },

  async getUser(address: string): Promise<UserProfile | undefined> {
    await ensureReady();
    return store().users?.[address.toLowerCase()];
  },

  async listUsers(): Promise<UserProfile[]> {
    await ensureReady();
    return Object.values(store().users || {});
  },

  async updateUser(
    address: string,
    patch: Partial<
      Pick<
        UserProfile,
        | "handle"
        | "watchlistMarketIds"
        | "watchlistKeywords"
        | "webhookUrl"
        | "agents"
        | "alerts"
      >
    >
  ): Promise<UserProfile> {
    await ensureReady();
    const key = address.toLowerCase();
    const profile = await this.ensureUser(key);
    Object.assign(profile, patch, { updatedAt: new Date().toISOString() });
    if (patch.handle) profile.handle = patch.handle.trim().slice(0, 32) || profile.handle;
    if (patch.webhookUrl !== undefined) {
      profile.webhookUrl = patch.webhookUrl?.trim() || undefined;
    }
    store().users[key] = profile;
    persist();
    return profile;
  },

  async toggleWatchMarket(address: string, marketId: string): Promise<UserProfile> {
    const profile = await this.ensureUser(address);
    const set = new Set(profile.watchlistMarketIds);
    if (set.has(marketId)) set.delete(marketId);
    else set.add(marketId);
    return this.updateUser(address, { watchlistMarketIds: [...set] });
  },

  async setWatchKeywords(address: string, keywords: string[]): Promise<UserProfile> {
    const cleaned = keywords
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    return this.updateUser(address, { watchlistKeywords: cleaned });
  },

  async addAgent(
    address: string,
    input: { name: string; callbackUrl: string; maxUsdcPerDay?: number }
  ): Promise<Agent> {
    const profile = await this.ensureUser(address);
    let url: URL;
    try {
      url = new URL(input.callbackUrl);
    } catch {
      throw new Error("INVALID_CALLBACK_URL");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("INVALID_CALLBACK_URL");
    }
    const agent: Agent = {
      id: uid("agt"),
      name: input.name.trim().slice(0, 48) || "agent",
      callbackUrl: url.toString(),
      maxUsdcPerDay: input.maxUsdcPerDay,
      createdAt: new Date().toISOString(),
      ownerAddress: address.toLowerCase(),
    };
    const agents = [...profile.agents, agent].slice(-20);
    await this.updateUser(address, { agents });
    return agent;
  },

  async removeAgent(address: string, agentId: string): Promise<UserProfile> {
    const profile = await this.ensureUser(address);
    return this.updateUser(address, {
      agents: profile.agents.filter((a) => a.id !== agentId),
    });
  },

  async pushUserAlert(
    address: string,
    alert: Omit<UserAlert, "id" | "at" | "read">
  ) {
    const profile = await this.ensureUser(address);
    const next: UserAlert = {
      ...alert,
      id: uid("alt"),
      at: new Date().toISOString(),
      read: false,
    };
    const alerts = [next, ...profile.alerts].slice(0, 50);
    await this.updateUser(address, { alerts });
  },

  async markAlertsRead(address: string) {
    const profile = await this.ensureUser(address);
    await this.updateUser(address, {
      alerts: profile.alerts.map((a) => ({ ...a, read: true })),
    });
  },

  async deskFor(address: string) {
    await ensureReady();
    const key = address.toLowerCase();
    const profile = await this.ensureUser(key);
    const markets = store().markets.filter(
      (m) =>
        m.createdBy === key || profile.watchlistMarketIds.includes(m.id)
    );
    const stakes = store().stakes.filter((s) => s.address === key);
    const challenges = store().challenges.filter((c) => c.address === key);
    const breaks = challenges.filter((c) => c.brokeThreshold);
    const activity = (store().activity || []).filter(
      (a) =>
        (a.marketId && profile.watchlistMarketIds.includes(a.marketId)) ||
        markets.some((m) => m.id === a.marketId)
    );
    return { profile, markets, stakes, challenges, breaks, activity };
  },
};
