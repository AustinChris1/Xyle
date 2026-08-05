"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConnect, useConnectors, type Connector } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/ActionButton";
import { SignOutIcon, UserIcon, WalletIcon } from "@/components/Icon";
import {
  INSTALL_LINKS,
  dedupeConnectors,
  humanWalletError,
  isUsable,
  noWalletMessage,
} from "@/lib/wallet-detect";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ConnectWallet() {
  const { connectAsync, isPending } = useConnect();
  const connectors = useConnectors();
  const toast = useToast();
  const {
    user,
    loading,
    signingIn,
    error: authError,
    isConnected,
    address,
    signIn,
    signOut,
  } = useAuth();

  const [available, setAvailable] = useState<Connector[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Extensions announce themselves shortly after load, so probe again once
  // rather than judging availability on the first render alone.
  useEffect(() => {
    let cancelled = false;

    async function probe() {
      const candidates = dedupeConnectors(connectors);
      const checks = await Promise.all(candidates.map(isUsable));
      const usable = candidates.filter((_, i) => checks[i]);
      if (!cancelled) setAvailable(usable);
    }

    void probe();
    const t = setTimeout(() => void probe(), 900);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [connectors]);

  useEffect(() => {
    if (authError) toast.error(authError);
  }, [authError, toast]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  /**
   * Connect and sign in as one gesture, which is what people expect from a
   * wallet button. If the signature is dismissed the wallet stays connected
   * and the button falls back to an explicit "Sign in", so nothing is lost.
   */
  const connectWith = useCallback(
    async (connector: Connector) => {
      setPickerOpen(false);
      let account: string | undefined;
      let connectedChain: number | undefined;

      try {
        const res = await connectAsync({
          connector,
          chainId: baseSepolia.id,
        });
        account = res.accounts?.[0];
        connectedChain = res.chainId;
      } catch (err) {
        const { message, kind } = humanWalletError(err);
        if (kind === "warn") toast.warn(message);
        else toast.error(message);
        return;
      }

      if (!account) return;

      try {
        await signIn({ address: account, chainId: connectedChain });
        toast.success("Signed in. Miner fees still come from the app wallet.");
      } catch {
        // The connection succeeded, only the signature was refused. The
        // effect on authError surfaces the reason.
      }
    },
    [connectAsync, signIn, toast]
  );

  const onConnectClick = useCallback(() => {
    const list = available ?? [];
    if (list.length === 0) {
      toast.error(noWalletMessage());
      return;
    }
    if (list.length === 1) {
      void connectWith(list[0]!);
      return;
    }
    setPickerOpen((v) => !v);
  }, [available, connectWith, toast]);

  async function onSignIn() {
    if (!address) {
      toast.warn("Connect a wallet first, then sign in.");
      return;
    }
    try {
      await signIn();
      toast.success("Signed in. Miner fees still come from the app wallet.");
    } catch {
      // useAuth stores the message; the effect above surfaces it
    }
  }

  if (loading) {
    return (
      <span className="hidden font-mono text-[10px] text-faint sm:inline">
        …
      </span>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/desk"
          className="inline-flex items-center gap-1.5 rounded border border-copper/30 bg-copper/10 px-2 py-1 font-mono text-[11px] text-copper-hot hover:bg-copper/15"
        >
          <UserIcon size={12} />
          {user.handle}
          {user.unreadAlerts > 0 && (
            <span className="ml-1 rounded-full bg-signal px-1 text-[9px] text-white">
              {user.unreadAlerts}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => {
            void signOut();
            toast.info("Signed out");
          }}
          title="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-line hover:text-no"
        >
          <SignOutIcon size={14} title="Sign out" />
        </button>
      </div>
    );
  }

  // Reached only when the signature was dismissed after connecting.
  if (isConnected && address) {
    return (
      <button
        type="button"
        disabled={signingIn}
        onClick={() => void onSignIn()}
        className="inline-flex items-center gap-1.5 rounded border border-copper/40 bg-copper/10 px-2.5 py-1 text-[11px] font-semibold text-copper-hot hover:bg-copper/20 disabled:opacity-50"
      >
        {signingIn && <Spinner size={11} />}
        {signingIn ? "Check your wallet" : `Sign in ${shortAddr(address)}`}
      </button>
    );
  }

  const list = available ?? [];
  const none = available !== null && list.length === 0;
  const busy = isPending || signingIn;

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        disabled={busy}
        onClick={onConnectClick}
        aria-haspopup={list.length > 1 ? "menu" : undefined}
        aria-expanded={list.length > 1 ? pickerOpen : undefined}
        title={
          none
            ? noWalletMessage()
            : list.length === 1
              ? `Connect ${list[0]!.name}`
              : "Choose a wallet"
        }
        className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
          none
            ? "border-line text-muted hover:border-warn/40 hover:text-warn"
            : "border-line text-ink hover:border-copper/40 hover:text-copper-hot"
        }`}
      >
        {busy ? <Spinner size={11} /> : <WalletIcon size={12} />}
        {isPending
          ? "Check your wallet"
          : signingIn
            ? "Confirm signature"
            : none
              ? "No wallet found"
              : "Connect wallet"}
      </button>

      <AnimatePresence>
        {pickerOpen && list.length > 1 && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="panel absolute right-0 z-50 mt-2 w-60 rounded-xl p-1.5"
          >
            <p className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
              Choose a wallet
            </p>
            {list.map((c) => (
              <button
                key={c.uid}
                type="button"
                role="menuitem"
                onClick={() => void connectWith(c)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-copper/10"
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.icon}
                    alt=""
                    width={18}
                    height={18}
                    className="rounded"
                  />
                ) : (
                  <span className="h-4.5 w-4.5 rounded bg-copper/20" />
                )}
                {c.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {none && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="panel absolute right-0 z-50 mt-2 hidden w-64 rounded-xl p-3 text-xs text-muted sm:block"
          >
            <p className="text-ink">No browser wallet detected.</p>
            <p className="mt-1.5 leading-relaxed">
              Signing in only proves the address is yours. Miner fees are paid
              by the app, never by you.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
              {INSTALL_LINKS.map((l) => (
                <a
                  key={l.name}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-copper hover:text-copper-hot hover:underline"
                >
                  {l.name}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
