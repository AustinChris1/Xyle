const EXPLORERS: Record<string, { name: string; tx: string }> = {
  "eip155:84532": { name: "Base Sepolia", tx: "https://sepolia.basescan.org/tx/" },
  "eip155:8453": { name: "Base", tx: "https://basescan.org/tx/" },
};

export function networkName(network: string) {
  return EXPLORERS[network]?.name ?? network;
}

export function txUrl(network: string, hash: string) {
  const base = EXPLORERS[network]?.tx;
  return base ? `${base}${hash}` : undefined;
}
