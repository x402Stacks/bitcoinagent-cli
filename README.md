# AgentSats

AgentSats is a TypeScript ESM CLI for Bitcoin-paid agent workflows. It exposes explicit human, plain, and JSON output modes so the same commands work interactively for humans and deterministically for machines.

## Stack

- TypeScript
- ESM
- Commander.js
- Clack
- `@bomb.sh/tab`
- Zod
- tsx
- Vitest

## Use With npx

```bash
npx agentsats --help
npx agentsats services --json
```

## Local Development

```bash
pnpm install
pnpm dev --help
```

## Run In Human Mode

```bash
npx agentsats health
npx agentsats services
```

Human mode is the default. It uses Clack spinners plus readable summaries.

## Run In Plain Mode

```bash
npx agentsats services --plain
npx agentsats tiktok-profile --username creator_1 --plain
```

Plain mode is minimal readable text with no spinner and no extra decoration.

## Run In JSON Mode

```bash
npx agentsats services --json
npx agentsats service-endpoints --service twitter --json
npx agentsats twitter-tweets --user-id 2455740283 --count 20 --json
```

JSON mode is automation-safe:

- exactly one JSON object on stdout
- no prompts
- no spinner
- no ANSI noise
- no extra logs

## Bitcoinagent API Endpoint Commands

Endpoint commands call the Go `bitcoinagent` API. By default they use `BITCOINAGENT_API_URL`, falling back to `http://localhost:8082`. Every endpoint command also accepts `--api-url <url>`.

For local x402 testing, copy the example env file and load it into your shell before running commands:

```bash
cp .env.example .env
set -a
source .env
set +a
```

By default, AgentSats uses `AGENTSATS_WALLET_PROVIDER=private-key` and reads `STACKS_PRIVATE_KEY`. Set it to a funded testnet Stacks private key. Do not commit `.env`; only `.env.example` belongs in git.

To use an Open Wallet Standard vault wallet instead, set:

```bash
AGENTSATS_WALLET_PROVIDER=ows
OWS_WALLET=agent-treasury
OWS_CHAIN=stacks:2147483648
OWS_CLI=ows
OWS_PASSPHRASE=
```

`OWS_CHAIN` defaults from `STACKS_NETWORK` when unset. Use `stacks:1` for mainnet or `stacks:2147483648` for testnet.

```bash
npx agentsats health --json
npx agentsats services --json
npx agentsats service-endpoints --service twitter --json
npx agentsats service-endpoints --service linkedin --json
npx agentsats tiktok-profile --username creator_1 --json
npx agentsats tiktok-videos --sec-uid MS4wLjABAAAA_fake_sec_uid --count 20 --json
npx agentsats twitter-profile --username MrBeast --json
npx agentsats twitter-highlights --user-id 877807935493033984 --count 20 --json
npx agentsats twitter-tweets --user-id 2455740283 --count 20 --json
npx agentsats twitter-followings --user-id 2455740283 --count 20 --json
```

`tiktok-profile` maps to the API23 `GET /api/v1/tiktok/user/info` route with `uniqueId=<username>`. `tiktok-videos` maps to `GET /api/v1/tiktok/user/posts`, which requires `--sec-uid`.

For the expanded endpoint surface, use either a service command with a relative path or the full-path generic endpoint caller. Service commands are available for `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitch`, `twitter`, and `zillow`.

```bash
npx agentsats airbnb \
  --endpoint stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

npx agentsats google-flights \
  --endpoint booking/url \
  --method POST \
  --body-json '{"token":"booking-token"}' \
  --json

npx agentsats linkedin \
  --endpoint get-company-by-domain \
  --query domain=apple.com \
  --json

npx agentsats linkedin \
  --endpoint search-posts \
  --method POST \
  --body-json '{"search_keywords":"ai","page":1}' \
  --json
```

The generic caller accepts the complete endpoint path:

```bash
npx agentsats api-call \
  --method GET \
  --path /api/v1/airbnb/stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

npx agentsats api-call \
  --method POST \
  --path /api/v1/google-flights/booking/url \
  --body-json '{"token":"booking-token"}' \
  --json
```

The Twitter endpoints may return `PAYMENT_REQUIRED` when the API has x402 enforcement enabled. In JSON mode the CLI includes decoded `payment-required` challenge metadata in `error.details.paymentRequired`.

## Test

```bash
pnpm test
pnpm typecheck
```

## Build

```bash
pnpm build
node dist/index.js services --json
```

## Shell Completions

`@bomb.sh/tab` is wired through the built-in `complete` command added in `src/completions/tab.ts`.

Generate a completion script:

```bash
pnpm build
node dist/index.js complete zsh > ~/.agentsats-completion.zsh
node dist/index.js complete bash > ~/.agentsats-completion.bash
```

Install it in your shell startup file:

```bash
echo 'source ~/.agentsats-completion.zsh' >> ~/.zshrc
source ~/.zshrc
```

You can also call the command directly:

```bash
npx agentsats complete zsh > ~/.agentsats-completion.zsh
pnpm --silent completions:generate zsh > ~/.agentsats-completion.zsh
```

If the package is installed globally or linked into your shell `PATH`, this also works:

```bash
agentsats complete zsh > ~/.agentsats-completion.zsh
```

## Why This Structure Works Well For AgentSats

- `commands/` stays thin and focused on parsing plus delegation
- `services/` keeps business behavior independent from terminal rendering
- `output/` centralizes human and machine-safe rendering rules
- `utils/mode.ts` makes output mode resolution explicit instead of implicit
- `core/logger.ts` prevents accidental stdout/stderr noise in JSON mode
- `types/` gives stable contracts that future commands can follow

This keeps human polish and agent determinism separate instead of letting output behavior spread across the codebase.

## Add A New Command

1. Add the result and input types in `src/types/commands.ts`.
2. Put business logic in a new or existing file under `src/services/`.
3. Add a thin command module under `src/commands/` with Zod validation.
4. Reuse `resolveOutputMode`, `createCommandContext`, and the shared output helpers.
5. Register the command in `src/cli.ts`.
6. Add JSON-mode tests before adding the implementation.

Future commands such as `logs`, `cancel`, or `agents` can follow the same pattern without changing the core output contract.
