# agent-cli

Production-ready TypeScript starter for an agent-first CLI with explicit human, plain, and JSON output modes.

## Stack

- TypeScript
- ESM
- Commander.js
- Clack
- `@bomb.sh/tab`
- Zod
- tsx
- Vitest

## Install

```bash
pnpm install
```

## Run In Human Mode

```bash
pnpm exec tsx src/index.ts run --task "draft incident report"
pnpm exec tsx src/index.ts status --id task_draft_incident_report
pnpm exec tsx src/index.ts services
```

Human mode is the default. It uses Clack spinners plus readable summaries.

## Run In Plain Mode

```bash
pnpm exec tsx src/index.ts run --task "draft incident report" --plain
pnpm exec tsx src/index.ts status --id task_draft_incident_report --plain
pnpm exec tsx src/index.ts tiktok-profile --username creator_1 --plain
```

Plain mode is minimal readable text with no spinner and no extra decoration.

## Run In JSON Mode

```bash
pnpm exec tsx src/index.ts run --task "draft incident report" --json
pnpm exec tsx src/index.ts status --id task_draft_incident_report --json
pnpm exec tsx src/index.ts twitter-tweets --user-id 2455740283 --count 20 --json
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

Set `STACKS_PRIVATE_KEY` to a funded testnet Stacks private key. Do not commit `.env`; only `.env.example` belongs in git.

```bash
pnpm exec tsx src/index.ts health --json
pnpm exec tsx src/index.ts services --json
pnpm exec tsx src/index.ts service-endpoints --service twitter --json
pnpm exec tsx src/index.ts service-endpoints --service linkedin --json
pnpm exec tsx src/index.ts tiktok-profile --username creator_1 --json
pnpm exec tsx src/index.ts tiktok-videos --sec-uid MS4wLjABAAAA_fake_sec_uid --count 20 --json
pnpm exec tsx src/index.ts twitter-profile --username MrBeast --json
pnpm exec tsx src/index.ts twitter-highlights --user-id 877807935493033984 --count 20 --json
pnpm exec tsx src/index.ts twitter-tweets --user-id 2455740283 --count 20 --json
pnpm exec tsx src/index.ts twitter-followings --user-id 2455740283 --count 20 --json
```

`tiktok-profile` maps to the API23 `GET /api/v1/tiktok/user/info` route with `uniqueId=<username>`. `tiktok-videos` maps to `GET /api/v1/tiktok/user/posts`, which requires `--sec-uid`.

For the expanded endpoint surface, use either a service command with a relative path or the full-path generic endpoint caller. Service commands are available for `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitch`, `twitter`, and `zillow`.

```bash
pnpm exec tsx src/index.ts airbnb \
  --endpoint stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

pnpm exec tsx src/index.ts google-flights \
  --endpoint booking/url \
  --method POST \
  --body-json '{"token":"booking-token"}' \
  --json

pnpm exec tsx src/index.ts linkedin \
  --endpoint get-company-by-domain \
  --query domain=apple.com \
  --json

pnpm exec tsx src/index.ts linkedin \
  --endpoint search-posts \
  --method POST \
  --body-json '{"search_keywords":"ai","page":1}' \
  --json
```

The generic caller accepts the complete endpoint path:

```bash
pnpm exec tsx src/index.ts api-call \
  --method GET \
  --path /api/v1/airbnb/stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

pnpm exec tsx src/index.ts api-call \
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
node dist/index.js run --task "draft incident report"
```

## Shell Completions

`@bomb.sh/tab` is wired through the built-in `complete` command added in `src/completions/tab.ts`.

Generate a completion script:

```bash
pnpm build
node dist/index.js complete zsh > ~/.agent-cli-completion.zsh
node dist/index.js complete bash > ~/.agent-cli-completion.bash
```

Install it in your shell startup file:

```bash
echo 'source ~/.agent-cli-completion.zsh' >> ~/.zshrc
source ~/.zshrc
```

You can also call the command directly:

```bash
pnpm exec tsx src/index.ts complete zsh > ~/.agent-cli-completion.zsh
pnpm --silent completions:generate zsh > ~/.agent-cli-completion.zsh
```

If the package is installed globally or linked into your shell `PATH`, this also works:

```bash
agent-cli complete zsh > ~/.agent-cli-completion.zsh
```

## Why This Structure Works Well For Agent-First CLIs

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
