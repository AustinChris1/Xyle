"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { humanWalletError } from "@/lib/wallet-detect";

export interface AuthUser {
  address: string;
  handle: string;
  chainId?: number;
  watchlistMarketIds: string[];
  unreadAlerts: number;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.isLoggedIn) return null;
  return {
    address: data.address,
    handle: data.handle,
    chainId: data.chainId,
    watchlistMarketIds: data.watchlistMarketIds ?? [],
    unreadAlerts: data.unreadAlerts ?? 0,
  };
}

export function useAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // react-query owns the session read, so the session survives navigation and
  // every component calling useAuth shares one request instead of racing.
  const { data: user = null, isLoading: loading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 30_000,
    retry: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  /**
   * `override` exists so a fresh connection can sign in immediately. Right
   * after `connectAsync` resolves, wagmi's `address` has not re-rendered yet,
   * so the caller passes the account it just received.
   */
  const signIn = useCallback(
    async (override?: { address?: string; chainId?: number }) => {
      const signer = override?.address ?? address;
      if (!signer) {
        setError("Connect a wallet first");
        throw new Error("Connect a wallet first");
      }
      setSigningIn(true);
      setError(null);
      try {
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      // Always use the page origin for SIWE domain so local/prod match the browser.
      const origin = window.location.origin;
      const domain = window.location.host;
      const message = new SiweMessage({
        domain,
        address: signer,
        statement:
          "Sign in to Signal Arena. This proves wallet ownership. Miner fees stay on the app server.",
        uri: origin,
        version: "1",
        chainId: override?.chainId ?? chainId ?? 84532,
        nonce,
      });
      const prepared = message.prepareMessage();
      const signature = await signMessageAsync({
        account: signer as `0x${string}`,
        message: prepared,
      });
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prepared, signature }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(data.detail || data.error || "Sign-in failed");
      }
        await refresh();
      } catch (err) {
        setError(humanWalletError(err).message);
        throw err;
      } finally {
        setSigningIn(false);
      }
    },
    [address, chainId, signMessageAsync, refresh]
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.setQueryData(["auth", "me"], null);
    disconnect();
  }, [disconnect, queryClient]);

  return {
    user,
    loading,
    signingIn,
    error,
    isConnected,
    address,
    chainId,
    signIn,
    signOut,
    refresh,
  };
}
