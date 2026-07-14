---
name: verify
description: Drive the built agentsats CLI end-to-end against a local mock x402 API to observe payment behavior without spending funds.
---

# Verifying agentsats end to end

Build and run the real binary:

```sh
pnpm build && node dist/index.js --version
```

## Mock x402 API surface

Start a plain-node HTTP server on a local port that:
- returns `402` with a base64 `payment-required` header (x402 v2 challenge: `{x402Version: 2, resource: {...}, accepts: [{scheme: 'exact', network: 'stacks:1', amount: '10', asset: 'STX', payTo: 'SP...', ...}]}`) when the request has no `payment-signature` header,
- returns `200` with `{data: ..., meta: {provider}}` plus a base64 `payment-response` header when it does.

Then drive paid commands with:

```sh
export BITCOINAGENT_API_URL=http://localhost:<port>/
export STACKS_PRIVATE_KEY=<any 64-hex + '01' throwaway key>
node dist/index.js twitter-profile --username MrBeast --json
```

Gotchas:
- Fee estimation and nonce lookups go to the REAL Stacks mainnet node (URL not configurable in the CLI) — read-only, needs network access, and estimates vary run to run (observed 523–1095 µSTX).
- Nothing is broadcast on-chain: the signed tx only travels in the `payment-signature` header to the mock, so a throwaway key is safe.
- Fee-cap knobs for forcing paths deterministically: `AGENTSATS_MAX_FEE_USTX=1` forces `FEE_TOO_HIGH` (exit 1); a huge value exercises the bigint parse; `AGENTSATS_FEE_MAX_RETRIES`/`AGENTSATS_FEE_RETRY_DELAY_MS` bound the wait.
- Log `payment-signature` presence per request in the mock to prove whether a payment was actually sent.
- Pre-existing quirk: `node dist/index.js --version` prints the version, then re-prints it styled as an error and exits 1 (CommanderError 'commander.version' isn't treated as a success exit in `runCli`).
