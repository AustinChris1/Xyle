import { AsyncLocalStorage } from "node:async_hooks";

export interface CallContext {
  /** Where the call came from, e.g. "market:mkt_abc" or "api:verify". */
  context: string;
  marketId?: string;
}

const storage = new AsyncLocalStorage<CallContext>();

/**
 * Tags every miner call made inside `fn` so the ledger can attribute it
 * without threading a context argument through each client function.
 */
export function withCallContext<T>(ctx: CallContext, fn: () => Promise<T>) {
  return storage.run(ctx, fn);
}

export function currentCallContext(): CallContext {
  return storage.getStore() ?? { context: "unattributed" };
}
