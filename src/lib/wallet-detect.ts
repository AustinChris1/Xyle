import type { Connector } from "wagmi";

/**
 * Turns wagmi's connector list into the set a user can actually click.
 *
 * Wagmi exposes one connector per EIP-6963 announcement plus the generic
 * `injected` fallback. When any wallet has announced itself, the fallback is
 * a duplicate of one of them pointing at `window.ethereum`, so it is dropped.
 */

export const INSTALL_LINKS = [
  { name: "MetaMask", url: "https://metamask.io/download/" },
  { name: "Rabby", url: "https://rabby.io/" },
  { name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet/downloads" },
];

export function isFallbackConnector(c: Connector) {
  return c.id === "injected";
}

export function dedupeConnectors(connectors: readonly Connector[]): Connector[] {
  const announced = connectors.filter((c) => !isFallbackConnector(c));
  const list = announced.length > 0 ? announced : connectors.slice();

  const seen = new Set<string>();
  return list.filter((c) => {
    const key = (c.name || c.id).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Confirms a connector still has a live provider behind it. */
export async function isUsable(c: Connector): Promise<boolean> {
  try {
    return Boolean(await c.getProvider());
  } catch {
    return false;
  }
}

export function noWalletMessage() {
  return "No browser wallet detected. Install MetaMask, unlock it, then try again.";
}

/**
 * Maps wallet and EIP-1193 failures onto something a person can act on.
 * Codes come from EIP-1193 and the JSON-RPC error range wallets use.
 */
export function humanWalletError(err: unknown): {
  message: string;
  kind: "error" | "warn";
} {
  const e = err as { code?: number | string; message?: string; name?: string };
  const code = typeof e?.code === "number" ? e.code : undefined;
  const raw = String(e?.message ?? err ?? "");

  if (code === 4001 || /reject|denied|cancell?ed/i.test(raw)) {
    return {
      kind: "warn",
      message: "You dismissed the wallet prompt. Nothing was signed.",
    };
  }

  if (code === -32002 || /already pending|already processing/i.test(raw)) {
    return {
      kind: "warn",
      message:
        "Your wallet already has a request open. Finish or dismiss it in the extension, then try again.",
    };
  }

  if (/no account exist|no accounts|account is locked|unlock/i.test(raw)) {
    return {
      kind: "error",
      message:
        "That wallet has no unlocked account. Open the extension, create or unlock an account, then try again.",
    };
  }

  if (code === 4900 || code === 4901 || /disconnected/i.test(raw)) {
    return {
      kind: "error",
      message: "The wallet disconnected. Reopen the extension and try again.",
    };
  }

  if (/chain|network|unsupported/i.test(raw)) {
    return {
      kind: "error",
      message:
        "Add or switch to the Base Sepolia network in your wallet, then try again.",
    };
  }

  if (/provider not found|window\.ethereum|no injected/i.test(raw)) {
    return { kind: "error", message: noWalletMessage() };
  }

  const trimmed = raw.split("\n")[0]!.trim();
  return {
    kind: "error",
    message: trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed || "The wallet request failed.",
  };
}
