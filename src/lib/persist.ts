import { promises as fs } from "fs";
import path from "path";
import type {
  ActivityItem,
  ChallengeAttempt,
  ConsumptionEntry,
  Market,
  OracleTick,
  Stake,
} from "./types";

export interface PersistedStore {
  markets: Market[];
  stakes: Stake[];
  ticks: OracleTick[];
  challenges: ChallengeAttempt[];
  consumption: ConsumptionEntry[];
  activity: ActivityItem[];
  minerRequests: number;
  totalCostUsdc: number;
  lastCronAt?: string;
  seeded: boolean;
  seedVersion: number;
  version: 1;
}

const EMPTY: PersistedStore = {
  markets: [],
  stakes: [],
  ticks: [],
  challenges: [],
  consumption: [],
  activity: [],
  minerRequests: 0,
  totalCostUsdc: 0,
  seeded: false,
  seedVersion: 0,
  version: 1,
};

const KV_KEY = "signal-arena-v1";
const localPath = () => path.join(process.cwd(), ".data", "store.json");

function hasTurso() {
  return Boolean(
    process.env.TURSO_DATABASE_URL?.trim() &&
      process.env.TURSO_AUTH_TOKEN?.trim()
  );
}

async function ensureTursoTable() {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  await client.execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  return client;
}

export async function loadPersisted(): Promise<PersistedStore> {
  try {
    if (hasTurso()) {
      const client = await ensureTursoTable();
      const rs = await client.execute({
        sql: "SELECT value FROM kv WHERE key = ?",
        args: [KV_KEY],
      });
      const row = rs.rows[0];
      if (row && typeof row.value === "string") {
        return { ...EMPTY, ...JSON.parse(row.value) };
      }
      return { ...EMPTY };
    }

    const raw = await fs.readFile(localPath(), "utf8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

let saveQueue: Promise<void> = Promise.resolve();

export function queueSave(store: PersistedStore) {
  saveQueue = saveQueue
    .then(() => savePersisted(store))
    .catch((err) => console.error("[persist] save failed:", err));
  return saveQueue;
}

async function savePersisted(store: PersistedStore) {
  const payload = JSON.stringify(store);
  if (hasTurso()) {
    const client = await ensureTursoTable();
    await client.execute({
      sql: `INSERT INTO kv (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [KV_KEY, payload],
    });
    return;
  }

  const file = localPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, payload, "utf8");
}

export function emptyStore(): PersistedStore {
  return {
    ...EMPTY,
    markets: [],
    stakes: [],
    ticks: [],
    challenges: [],
    consumption: [],
    activity: [],
  };
}

export function backendLabel() {
  if (hasTurso()) return "turso";
  return "local-file";
}
