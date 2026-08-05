export type MarketStatus = "open" | "settled_yes" | "settled_no" | "expired";
export type StakeSide = "yes" | "no";
export type OracleVerdict = "yes" | "no" | "uncertain";
export type ProofRole = "authenticity" | "news" | "reason" | "consensus";

/** How much of the four-stage pipeline actually completed. */
export interface StageSummary {
  total: number;
  completed: number;
  /** Names of stages that fell back or were unreachable. */
  degraded: string[];
}

/**
 * One person's call on a market. Deliberately has no size: an unbacked wager
 * amount measures nothing, whereas one forecast per wallet measures whether
 * you were right, which is the only score a forecasting product should keep.
 * `amount` lingers on pre-existing rows and is ignored.
 */
export interface Forecast {
  id: string;
  marketId: string;
  player: string;
  /** Lowercased address. One forecast per address per market. */
  address?: string;
  side: StakeSide;
  createdAt: string;
  /** @deprecated conviction size from before forecasts; no longer written */
  amount?: number;
}

/** @deprecated use Forecast */
export type Stake = Forecast;

export interface PaymentProof {
  subnet: "itsai" | "desearch" | "groq" | ProofRole;
  role?: ProofRole;
  minerId?: string;
  label?: string;
  mocked: boolean;
  txHash?: string;
  latencyMs: number;
  costUsdc?: number;
}

export interface OracleTick {
  id: string;
  marketId: string;
  at: string;
  verdict: OracleVerdict;
  confidence: number;
  reasoning: string;
  sources: Array<{
    title: string;
    snippet: string;
    url?: string;
    /** ISO date the source was published, when the miner reports one. */
    publishedAt?: string;
  }>;
  authenticity: {
    aiLikely: boolean;
    score: number;
    detail: string;
    /** True when the detector miner was down and the heuristic stood in. */
    degraded?: boolean;
  };
  stages?: StageSummary;
  consensus?: {
    judgeA: OracleVerdict;
    judgeB: OracleVerdict;
    agreed: boolean;
  };
  proofs: PaymentProof[];
  settled: boolean;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  eventClass: string;
  searchQuery: string;
  confidenceThreshold: number;
  potYes: number;
  potNo: number;
  status: MarketStatus;
  closesAt: string;
  createdAt: string;
  settledAt?: string;
  settlementTickId?: string;
  lastOracleAt?: string;
  source?: "seed" | "user" | "auto";
  sourceHeadline?: string;
  /** Creator address when opened while signed in. */
  createdBy?: string;
  createdByHandle?: string;
}

export interface ChallengeAttempt {
  id: string;
  player: string;
  address?: string;
  text: string;
  createdAt: string;
  foolScore: number;
  confidence: number;
  aiDetected: boolean;
  verdict: OracleVerdict;
  reasoning: string;
  proofs: PaymentProof[];
  brokeThreshold: boolean;
}

export interface LeaderboardEntry {
  player: string;
  /** Forecasts on markets that have since settled. */
  resolved: number;
  correct: number;
  /** correct / resolved, 0 when nothing has resolved yet. */
  accuracy: number;
  /** Forecasts still waiting on a settlement. */
  pending: number;
  challengeBest: number;
  challengeCount: number;
  totalScore: number;
}

/** One paid miner call, public ledger row. */
export interface ConsumptionEntry {
  id: string;
  at: string;
  minerId: string;
  label: string;
  role: ProofRole | string;
  latencyMs: number;
  costUsdc: number;
  mocked: boolean;
  txHash?: string;
  context: string;
  marketId?: string;
  success: boolean;
}

export interface ActivityItem {
  id: string;
  at: string;
  kind:
    | "market_opened"
    | "oracle_tick"
    | "settled"
    | "challenge"
    | "break"
    | "auto_market";
  title: string;
  detail?: string;
  href?: string;
  marketId?: string;
}

export interface VerifyResult {
  claim: string;
  at: string;
  verdict: OracleVerdict;
  confidence: number;
  reasoning: string;
  authenticity: {
    aiLikely: boolean;
    score: number;
    detail: string;
  };
  consensus: {
    judgeA: OracleVerdict;
    judgeB: OracleVerdict;
    agreed: boolean;
  };
  sources: Array<{
    title: string;
    snippet: string;
    url?: string;
    /** ISO date the source was published, when the miner reports one. */
    publishedAt?: string;
  }>;
  proofs: PaymentProof[];
  minerCalls: number;
  costUsdcEstimate: number;
  stages?: StageSummary;
}

/** Registered automation agent owned by a SIWE user. */
export interface Agent {
  id: string;
  name: string;
  callbackUrl: string;
  /** Soft budget note for the demo; server still pays miners. */
  maxUsdcPerDay?: number;
  createdAt: string;
  ownerAddress: string;
}

/** Per-wallet profile (identity via SIWE). */
export interface UserProfile {
  address: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
  watchlistMarketIds: string[];
  watchlistKeywords: string[];
  /** Personal settle / alert webhook. */
  webhookUrl?: string;
  agents: Agent[];
  /** In-app alerts when watched markets settle or cross confidence. */
  alerts: UserAlert[];
}

export interface UserAlert {
  id: string;
  at: string;
  kind: "settled" | "confidence" | "agent_delivery";
  title: string;
  detail?: string;
  href?: string;
  marketId?: string;
  read: boolean;
}
