import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Wallet discovery is left to EIP-6963, which wagmi enables by default.
 *
 * Sniffing `window.ethereum` does not work when several extensions are
 * installed: whichever one loads last owns the global, and many of them never
 * populate the legacy `providers` array. Under EIP-6963 every extension
 * announces itself separately with a stable rdns id, name and icon, so we get
 * one connector per installed wallet and the user picks.
 *
 * The plain `injected()` connector below is only a fallback for older wallets
 * that never announce. The UI drops it whenever an announced wallet exists.
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
