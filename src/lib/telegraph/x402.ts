/**
 * x402 payment-aware fetch (Telegraph MCP pattern).
 * Live PAYMENT-REQUIRED uses network eip155:84532 (Base Sepolia) USDC.
 */

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "../config";

export interface PaymentCapture {
  txHash?: string;
}

function extractTxHash(settleHeader: string): string | undefined {
  const candidates = [
    settleHeader,
    Buffer.from(settleHeader, "base64").toString("utf8"),
  ];
  for (const candidate of candidates) {
    try {
      const json = JSON.parse(candidate) as Record<string, unknown>;
      const val = json.transaction ?? json.tx ?? json.signature;
      if (typeof val === "string") return val;
    } catch {
      if (/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(candidate)) return candidate;
      if (/^0x[a-fA-F0-9]{64}$/.test(candidate)) return candidate;
    }
  }
  return undefined;
}

export function withTxCapture(
  paymentFetch: typeof fetch,
  capture: PaymentCapture
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await paymentFetch(input, init);
    const settle =
      res.headers.get("payment-response") ??
      res.headers.get("x-payment-response");
    if (settle) {
      const extracted = extractTxHash(settle);
      if (extracted) capture.txHash = extracted;
    }
    return res;
  };
}

let cached: typeof fetch | null = null;
let initPromise: Promise<typeof fetch> | null = null;

export async function createPaymentFetch(): Promise<typeof fetch> {
  if (cached) return cached;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const cfg = loadConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemes: any[] = [];

    if (cfg.evmPrivateKey) {
      const hex = cfg.evmPrivateKey.startsWith("0x")
        ? cfg.evmPrivateKey
        : `0x${cfg.evmPrivateKey}`;
      const account = privateKeyToAccount(hex as `0x${string}`);
      const evmSigner = toClientEvmSigner(account);
      schemes.push({
        network: cfg.evmNetwork,
        client: new ExactEvmScheme(evmSigner),
      });
      console.log(
        `[x402] EVM ready ${cfg.evmNetwork} from ${account.address}`
      );
    }

    if (cfg.solanaPrivateKey) {
      try {
        const { ExactSvmScheme, toClientSvmSigner } = await import("@x402/svm");
        const { createKeyPairSignerFromBytes } = await import("@solana/kit");
        const { base58 } = await import("@scure/base");
        const keypair = await createKeyPairSignerFromBytes(
          base58.decode(cfg.solanaPrivateKey)
        );
        schemes.push({
          network: cfg.svmNetwork,
          client: new ExactSvmScheme(toClientSvmSigner(keypair)),
        });
        console.log(`[x402] SVM ready ${cfg.svmNetwork}`);
      } catch (err) {
        console.warn("[x402] SVM skipped:", (err as Error).message);
      }
    }

    if (schemes.length === 0) {
      console.warn(
        "[x402] No payment key. Set EVM_PRIVATE_KEY for Base Sepolia. See KEYS.md"
      );
      cached = fetch;
      return fetch;
    }

    try {
      cached = wrapFetchWithPaymentFromConfig(fetch, {
        schemes,
      }) as typeof fetch;
      return cached;
    } catch (err) {
      console.error("[x402] init failed:", (err as Error).message);
      cached = fetch;
      return fetch;
    }
  })();

  return initPromise;
}
