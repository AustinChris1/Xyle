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

export interface Stake {
  id: string;
  marketId: string;
  player: string;
  side: StakeSide;
  amount: number;
  createdAt: string;
}

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
  sources: Array<{ title: string; snippet: string; url?: string }>;
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
}

export interface ChallengeAttempt {
  id: string;
  player: string;
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
  stakeWins: number;
  stakePnL: number;
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
    degraded?: boolean;
  };
  stages: StageSummary;
  consensus: {
    judgeA: OracleVerdict;
    judgeB: OracleVerdict;
    agreed: boolean;
  };
  sources: Array<{ title: string; snippet: string; url?: string }>;
  proofs: PaymentProof[];
  minerCalls: number;
  costUsdcEstimate: number;
}
