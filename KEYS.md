# Keys and payments

Signal Arena does **not** use a Telegraph API key.  
Live miners return **HTTP 402** and collect **USDC** via **x402**.

## Network that matters

Probed payment challenge from the live node:

| Field | Value |
|-------|--------|
| Network | `eip155:84532` (Base Sepolia) |
| Typical cost | ~0.01 USDC per successful call |
| Node | `http://13.237.89.59:7044` (override with `TELEGRAPH_NODE_URL`) |

**Base Sepolia ETH + USDC** fund the burner used in `EVM_PRIVATE_KEY`.  
Solana SOL alone does not pay the current 402 challenge.

## Create a free burner

```bash
pnpm keys:evm --write
```

1. Copy the printed address.  
2. Get Base Sepolia ETH (gas) from a public faucet.  
3. Get Base Sepolia USDC from [faucet.circle.com](https://faucet.circle.com).  
4. Set `FORCE_MOCK=false` and restart the app.

## Important env vars

| Variable | Meaning |
|----------|---------|
| `EVM_PRIVATE_KEY` | `0x` hex private key for Base Sepolia |
| `EVM_NETWORK` | default `eip155:84532` |
| `FORCE_MOCK` | `true` = simulated miners (not for judging) |
| `CRON_SECRET` | protects auto market + tick endpoint |
| `VERIFY_PER_IP_HOURLY` | default `6` |
| `VERIFY_DAILY_CAP_USDC` | default `2` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | durable store on Vercel |

## Safety

- Use a **burner** only.  
- Never commit `.env.local`.  
- Rotate keys if they appear in chat logs or screenshots.  
- Public `POST /api/oracle/verify` spends real USDC; keep rate limits on.

See [README.md](./README.md) for how to run the app, and [ARCHITECTURE.md](./ARCHITECTURE.md) for pipeline detail.
