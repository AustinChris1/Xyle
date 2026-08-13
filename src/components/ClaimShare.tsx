"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShareIcon } from "./Icon";
import { useToast } from "./Toast";

const LINE: Record<string, string> = {
  yes: "Four independent miners checked this and it holds up.",
  no: "Four independent miners checked this. It does not hold up.",
  uncertain: "Four independent miners checked this. The evidence is not there yet.",
};

/** A verdict is only useful if it can be dropped into an argument. */
export function ClaimShare({
  claimId,
  verdict,
}: {
  claimId: string;
  verdict: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  function url() {
    return `${window.location.origin}/c/${claimId}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the address bar instead.");
    }
  }

  function post() {
    const text = `${LINE[verdict] ?? LINE.uncertain} ${url()}`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => void copy()}
        className="btn-ghost text-xs"
      >
        {copied ? "Copied" : "Copy link"}
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={post}
        className="btn-ghost text-xs"
      >
        <ShareIcon size={13} />
        Post
      </motion.button>
    </div>
  );
}
