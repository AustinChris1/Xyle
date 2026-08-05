import type { Metadata } from "next";
import { DeskClient } from "@/components/DeskClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My desk",
  description:
    "SIWE profile, watchlist, alerts, and agent webhooks. Server pays miner fees.",
};

export default function DeskPage() {
  return <DeskClient />;
}
