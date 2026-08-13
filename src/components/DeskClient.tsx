"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ActionButton } from "@/components/ActionButton";
import { useToast } from "@/components/Toast";
import { BoltIcon, PlusIcon, SaveIcon, TrashIcon } from "@/components/Icon";
import type {
  Agent,
  ChallengeAttempt,
  Market,
  Stake,
  UserAlert,
  UserProfile,
  ActivityItem,
} from "@/lib/types";
import { StatusPill } from "./StatusPill";

interface DeskPayload {
  profile: UserProfile;
  markets: Market[];
  stakes: Stake[];
  challenges: ChallengeAttempt[];
  breaks: ChallengeAttempt[];
  activity: ActivityItem[];
}

async function fetchDesk(): Promise<DeskPayload> {
  const res = await fetch("/api/me");
  if (!res.ok) throw new Error("Could not load desk");
  return (await res.json()) as DeskPayload;
}

export function DeskClient() {
  const { user, loading: authLoading, refresh } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentUrl, setAgentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const { data: desk = null, error: deskError } = useQuery({
    queryKey: ["desk", user?.address ?? null],
    queryFn: fetchDesk,
    enabled: Boolean(user),
    retry: false,
  });

  // Form fields hold an edit on top of the saved value rather than being
  // copied into state on load, so a refetch never clobbers what is being typed.
  const [handleEdit, setHandleEdit] = useState<string | null>(null);
  const [webhookEdit, setWebhookEdit] = useState<string | null>(null);
  const [keywordsEdit, setKeywordsEdit] = useState<string | null>(null);

  const handle = handleEdit ?? desk?.profile.handle ?? "";
  const webhookUrl = webhookEdit ?? desk?.profile.webhookUrl ?? "";
  const keywords =
    keywordsEdit ?? desk?.profile.watchlistKeywords.join(", ") ?? "";

  const load = useCallback(async () => {
    setHandleEdit(null);
    setWebhookEdit(null);
    setKeywordsEdit(null);
    await queryClient.invalidateQueries({ queryKey: ["desk"] });
  }, [queryClient]);

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          webhookUrl,
          watchlistKeywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          markAlertsRead: true,
        }),
      });
      if (!res.ok) throw new Error("Could not save your profile");
      await refresh();
      await load();
      toast.success("Profile saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save your profile";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function addAgent() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          callbackUrl: agentUrl,
          maxUsdcPerDay: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail || data.error || "Could not register agent");
      setAgentName("");
      setAgentUrl("");
      await load();
      toast.success("Agent registered. It will be called on settlement.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not register agent";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(agentId?: string, label = "endpoint") {
    setTesting(agentId ?? "personal");
    try {
      const res = await fetch("/api/me/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentId ? { agentId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Test failed");
      if (data.ok) {
        toast.success(`Test event delivered to ${label} (HTTP ${data.status})`);
      } else {
        toast.error(`${label} did not accept it: ${data.error ?? `HTTP ${data.status}`}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(null);
    }
  }

  async function removeAgent(id: string) {
    try {
      const res = await fetch(`/api/me/agents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove that agent");
      await load();
      toast.info("Agent removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that agent");
    }
  }

  if (authLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="panel rounded-xl p-8 text-center">
        <p className="eyebrow">My desk</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in with your wallet</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Connect MetaMask (or any injected wallet) on Base Sepolia, then sign a
          SIWE message. Miner fees still come from the app server. Wallet is
          only identity.
        </p>
        <p className="mt-4 text-sm text-copper">
          Use the Connect wallet control in the top nav.
        </p>
      </div>
    );
  }

  if (!desk) {
    return <p className="text-muted">Loading desk…</p>;
  }

  const { profile, markets, stakes, challenges, breaks, activity } = desk;

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">My desk</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {profile.handle}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted">{profile.address}</p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Watch markets, register agent webhooks, and collect personal share
          lines. Server still pays x402 miner fees.
        </p>
      </header>

      {(error || deskError) && (
        <p className="text-sm text-no">
          {error ?? (deskError as Error).message}
        </p>
      )}

      <section className="panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Handle
            <input
              value={handle}
              onChange={(e) => setHandleEdit(e.target.value)}
              className="input-desk mt-1"
            />
          </label>
          <label className="text-xs text-muted">
            Personal webhook (optional)
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookEdit(e.target.value)}
              placeholder="https://…"
              className="input-desk mt-1 font-mono text-sm"
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Watch keywords (comma-separated)
            <input
              value={keywords}
              onChange={(e) => setKeywordsEdit(e.target.value)}
              placeholder="ekubo, exploit, cancellation"
              className="input-desk mt-1"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <ActionButton
            pending={busy}
            pendingLabel="Saving"
            onClick={() => void saveProfile()}
            className="w-full text-sm sm:w-auto"
          >
            <SaveIcon size={14} />
            Save profile
          </ActionButton>
          <ActionButton
            variant="ghost"
            pending={testing === "personal"}
            pendingLabel="Sending"
            disabled={!desk.profile.webhookUrl}
            onClick={() => void sendTest(undefined, "your personal webhook")}
            className="w-full text-sm sm:w-auto"
          >
            <BoltIcon size={14} />
            Send test event
          </ActionButton>
        </div>
        {!desk.profile.webhookUrl && (
          <p className="mt-2 text-xs text-faint">
            Save a webhook URL first to enable the test.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel rounded-xl p-5">
          <h2 className="text-lg font-semibold">My markets</h2>
          <ul className="mt-3 space-y-2">
            {markets.length === 0 && (
              <li className="text-sm text-muted">
                None yet. Open one or pin from a market page.
              </li>
            )}
            {markets.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/markets/${m.id}`}
                  className="flex items-center justify-between gap-2 text-sm hover:text-copper"
                >
                  <span className="line-clamp-1">{m.title}</span>
                  <StatusPill status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel rounded-xl p-5">
          <h2 className="text-lg font-semibold">Alerts</h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {profile.alerts.length === 0 && (
              <li className="text-sm text-muted">No alerts yet.</li>
            )}
            {profile.alerts.map((a: UserAlert) => (
              <li
                key={a.id}
                className={`rounded-lg border border-line px-3 py-2 text-sm ${
                  a.read ? "opacity-60" : ""
                }`}
              >
                <div className="font-mono text-[10px] uppercase text-copper">
                  {a.kind}
                </div>
                <div>{a.title}</div>
                {a.detail && (
                  <div className="text-xs text-muted">{a.detail}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel rounded-xl p-5">
          <h2 className="text-lg font-semibold">My attempts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {challenges.length === 0 && (
              <li className="text-muted">No adversary runs yet.</li>
            )}
            {challenges.slice(0, 10).map((c) => (
              <li key={c.id} className="border-b border-line/50 pb-2">
                <span className="font-mono text-copper-hot">
                  {(c.foolScore * 100).toFixed(1)}
                </span>{" "}
                · {c.verdict}
                {c.brokeThreshold ? " · BREAK" : ""}
              </li>
            ))}
          </ul>
          {breaks.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              {breaks.length} break{breaks.length === 1 ? "" : "s"} on the hall.
            </p>
          )}
        </div>

        <div className="panel rounded-xl p-5">
          <h2 className="text-lg font-semibold">Conviction</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stakes.length === 0 && (
              <li className="text-muted">No positions yet.</li>
            )}
            {stakes.slice(-10).reverse().map((s) => (
              <li key={s.id} className="font-mono text-xs">
                {s.side.toUpperCase()} ·{" "}
                <Link
                  href={`/markets/${s.marketId}`}
                  className="text-copper hover:underline"
                >
                  market
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel-hot rounded-xl p-5">
        <h2 className="text-lg font-semibold">Agents</h2>
        <p className="mt-1 text-sm text-muted">
          Give us an https URL. When a market you watch settles, we POST a
          signed JSON event to it so your own code can react without polling.
          Miner fees stay on the app server, never on you.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-copper hover:text-copper-hot">
            What we send
          </summary>
          <div className="sunken mt-2 overflow-x-auto rounded-lg p-3">
            <pre className="font-mono text-[11px] leading-relaxed text-muted">
{`POST <your url>
X-Xyle-Signature: sha256=<hmac of the body>

{
  "type": "market.settled",
  "at": "2026-08-04T09:12:00.000Z",
  "market": {
    "id": "mkt_...", "title": "...",
    "status": "settled_yes",
    "verdict": "yes", "confidence": 0.86
  },
  "tick": { "id": "tick_...", "settled": true },
  "agentId": "agt_..."
}`}
            </pre>
          </div>
          <p className="mt-2 text-xs text-faint">
            Verify the signature with HMAC-SHA256 over the raw body using the
            shared secret. Delivery result shows up in your alerts either way.
          </p>
        </details>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Name
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="input-desk mt-1"
            />
          </label>
          <label className="text-xs text-muted">
            Callback URL
            <input
              value={agentUrl}
              onChange={(e) => setAgentUrl(e.target.value)}
              placeholder="https://your-agent.example/hook"
              className="input-desk mt-1 font-mono text-sm"
            />
          </label>
        </div>
        <ActionButton
          pending={busy}
          pendingLabel="Registering"
          disabled={!agentName || !agentUrl}
          onClick={() => void addAgent()}
          className="mt-4 w-full text-sm sm:w-auto"
        >
          <PlusIcon size={14} />
          Register agent
        </ActionButton>
        <ul className="mt-4 space-y-2">
          {profile.agents.map((a: Agent) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="font-mono text-[10px] text-muted">
                  {a.callbackUrl}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={testing === a.id}
                  onClick={() => void sendTest(a.id, a.name)}
                  title="Send a test event"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-copper/10 hover:text-copper-hot disabled:opacity-50"
                >
                  <BoltIcon size={14} title="Send a test event" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeAgent(a.id)}
                  title="Remove agent"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-no/10 hover:text-no"
                >
                  <TrashIcon size={14} title="Remove agent" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {activity.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Watched activity</h2>
          <ul className="mt-3 space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="panel rounded-lg px-4 py-2 text-sm">
                <span className="font-mono text-[10px] uppercase text-copper">
                  {a.kind}
                </span>
                <div>{a.title}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
