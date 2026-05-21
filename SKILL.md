---
name: agentsats-cli
description: Use when an agent needs to run, test, configure, document, or extend the AgentSats CLI, including bitcoinagent API endpoint commands, Open Wallet Standard default wallet setup, wallet funding addresses, private-key opt-in wallets, and paid x402 STX flows.
---

# AgentSats CLI

Use this project skill before operating or changing the AgentSats CLI. Prefer the public `npx agentsats ...` interface for usage examples, and keep changes compatible with the three output modes and the bitcoinagent/x402 contracts below.

## Primary npx Usage

```sh
npx agentsats --help
npx agentsats services --json
npx agentsats wallet setup --provider ows --preview-stacks --wallet agentsats-mainnet --network mainnet --json
npx agentsats wallet --json
npx agentsats twitter-profile --username MrBeast --json
```

Use `--json` for agent-readable output. JSON mode must emit exactly one JSON object line on stdout, no prompts, no banner, no ANSI, and empty stderr on success. `--json` takes precedence over `--plain`. `--json --help` is a `VALIDATION_ERROR`; help without `--json` exits 0.

Inside this repo, use `pnpm dev ...` only when validating local source changes before build/publish:

```sh
pnpm install
pnpm dev --help
pnpm dev services --json
pnpm test
pnpm typecheck
pnpm build
```

## Core Files

- `src/cli.ts`: runtime injection, Commander setup, help guard, normalized errors.
- `src/commands/api.ts`: endpoint command flags and Zod validation.
- `src/commands/wallet.ts`: wallet and `wallet setup` command handlers.
- `src/services/bitcoinagent-api.ts`: HTTP client, response unwrap, endpoint validation, x402 retry.
- `src/services/x402-payment.ts`: STX x402 signature creation for private-key and OWS wallets.
- `src/core/stacks-config.ts`: wallet/env/config resolution.
- `src/output/agent.ts` and `src/output/human.ts`: JSON, plain, and human rendering.

## JSON Contracts

All JSON output is:

```ts
{ success: boolean, data?: T, error?: { code: string, message: string, details?: unknown }, meta: { timestamp: string, mode: 'json' } }
```

`ApiEndpointResult` data contains `method`, `endpoint`, `url`, `statusCode`, optional `provider`, `response`, optional `paymentResponse`, and `timestamp`. Wallet data contains `address`, `network`, `provider`, and `timestamp`.

Error codes are `VALIDATION_ERROR`, `NOT_FOUND`, `PAYMENT_REQUIRED`, and `INTERNAL_ERROR`. Exit codes: success/help `0`, `NOT_FOUND` `2`, all other errors `1`.

## API URL

Endpoint commands call `BITCOINAGENT_API_URL` or default to `https://agentsats.stacksx402.com/`. Every endpoint command accepts `--api-url <url>`.

```sh
npx agentsats twitter-profile --username MrBeast --api-url http://localhost:8083 --json
```

## Endpoint Commands

Discovery:

| Command | API route |
| --- | --- |
| `health` | `GET /health` |
| `services` | `GET /api/v1/services` |
| `service-endpoints --service <name>` | `GET /api/v1/services/:service/endpoints` |

Named convenience commands:

| Command | API route and query |
| --- | --- |
| `tiktok-profile --username <username>` | `GET /api/v1/tiktok/user/info?uniqueId=...` |
| `tiktok-videos --sec-uid <secUid> [--count <n>] [--cursor <cursor>]` | `GET /api/v1/tiktok/user/posts?secUid=...&count=...&cursor=...` |
| `twitter-profile --username <username>` | `GET /api/v1/twitter/profile?username=...` |
| `twitter-highlights --user-id <id> [--count <n>]` | `GET /api/v1/twitter/highlights?user_id=...&count=...` |
| `twitter-tweets --user-id <id> [--count <n>]` | `GET /api/v1/twitter/tweets?user_id=...&count=...` |
| `twitter-followings --user-id <id> [--count <n>]` | `GET /api/v1/twitter/followings?user_id=...&count=...` |

Expanded API coverage:

- `api-call --method GET|POST --path /api/v1/... [--query key=value ...] [--body-json <json>]`
- Service-scoped commands: `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitter`
- Service commands require `--endpoint <path>` under `/api/v1/<service>` and accept the same `--method`, repeated `--query`, and `--body-json` flags.
- Do not put query strings in `--endpoint`; use `--query key=value`.
- Endpoint paths reject network-path references (`//...`), backslashes, invalid percent encoding, and `.` or `..` segments before any request is made.

Examples:

```sh
npx agentsats airbnb --endpoint stays/search --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA --json
npx agentsats google-flights --endpoint booking/url --method POST --body-json '{"token":"booking-token"}' --json
npx agentsats linkedin --endpoint get-company-by-domain --query domain=apple.com --json
npx agentsats linkedin --endpoint search-posts --method POST --body-json '{"search_keywords":"ai","page":1}' --json
npx agentsats api-call --path /api/v1/airbnb/stays/search --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA --json
```

## Wallet Configuration

For user-facing wallet setup, use OWS as the default and first recommendation. Only lead with private-key setup when the user explicitly says they will use a private key, already provides `STACKS_PRIVATE_KEY`, or asks for private-key env configuration.

Default OWS setup:

```sh
npx agentsats wallet setup --provider ows --preview-stacks --wallet agentsats-mainnet --network mainnet --json
```

After creating or selecting an OWS wallet, always surface the `data.address` value from JSON output and tell the user to send STX to that address before calling paid endpoints. Example wording:

```text
Your AgentSats Stacks address is <address>. Send STX to this address before using paid x402 endpoints.
```

OWS mode uses a local Open Wallet Standard vault wallet:

```sh
AGENTSATS_WALLET_PROVIDER=ows
OWS_WALLET=agentsats-mainnet
OWS_CHAIN=stacks:1
OWS_CLI=/path/to/ows
OWS_STACKS_KEY_ENCODING=uncompressed
OWS_PASSPHRASE=
```

`STACKS_NETWORK` accepts `mainnet` or `testnet` and defaults to `mainnet`. `OWS_CHAIN` accepts `stacks:1` or `stacks:2147483648` and defaults from `STACKS_NETWORK`. `OWS_CLI` defaults to `ows`. `OWS_STACKS_KEY_ENCODING` accepts `compressed` or `uncompressed` and defaults to `uncompressed`.

Private-key mode remains supported when explicitly requested:

```sh
AGENTSATS_WALLET_PROVIDER=private-key
STACKS_PRIVATE_KEY=...
STACKS_NETWORK=mainnet
```

Do not write private keys to the repo, docs, tests, generated config, or logs.

Optional config/cache overrides:

```sh
AGENTSATS_HOME=/custom/agentsats-home
AGENTSATS_CONFIG_PATH=/custom/config.json
```

## OWS Stacks Preview Setup

The exact preview warning text is:

```text
Stacks support in OWS is still under development.
```

Use the explicit setup command only when intentionally installing the preview:

```sh
npx agentsats wallet setup --provider ows --preview-stacks --wallet agentsats-mainnet --network mainnet --json
```

Preview setup requires `git --version` and `cargo --version`, clones `https://github.com/tony1908/core.git`, checks out commit `94e059363f172ed71fa72d7b0619508ae11ba0d1`, builds `ows`, creates the wallet if missing, and writes only non-secret config.

The setup result includes `data.address`. Always include that address in the user-facing response and tell the user to fund it with STX before paid API calls.

Default cache:

```text
~/.agentsats/ows/pr-115/94e059363f172ed71fa72d7b0619508ae11ba0d1/
```

Saved config:

```text
~/.agentsats/config.json
```

After setup, `npx agentsats wallet --json` and paid API commands can use the saved OWS config without repeating the `OWS_*` environment variables.

## x402 Payment Rules

- Paid endpoints return HTTP `402` with a base64 JSON `payment-required` header.
- AgentSats decodes `payment-required`; if a compatible STX wallet is configured, it signs a facilitator-bound STX transfer and retries with `payment-signature`.
- If the paid retry still returns `402`, AgentSats retries once more with the same `payment-signature`; it must not create a second payment for pending settlement.
- Successful paid responses may include base64 JSON `payment-response` or legacy `x-payment-response`; include decoded data as `paymentResponse`.
- If no compatible wallet exists or payment still fails, JSON mode returns `PAYMENT_REQUIRED` with decoded challenge metadata at `error.details.paymentRequired`.
- Keep Go middleware compatibility by omitting object-shaped top-level `resource` from x402 payment payloads.
- With OWS, build the Stacks transaction locally, run `ows sign tx --chain <chain> --wallet <wallet> --tx <hex> --json`, parse the returned 65-byte signature, and inject it into the standard single-sig transaction bytes at offset 44.
- Do not clone or build OWS during normal API calls. Only `wallet setup --provider ows --preview-stacks` may clone/build OWS.

## Adding Or Changing Commands

1. Add or update result/input types in `src/types/commands.ts`.
2. Keep command files thin: parse flags with Zod, create context, call services, render through output helpers.
3. Put API, wallet, x402, and filesystem behavior in `src/services/` or `src/core/`.
4. Preserve the `CliResponse<T>` shape and output-mode invariants.
5. Add JSON-mode tests with injected `now`, memory stdout/stderr, and injected `fetcher` or `commandRunner` for network/OWS behavior.

## Verification

Before reporting changes complete:

```sh
pnpm test
pnpm typecheck
pnpm build
```
