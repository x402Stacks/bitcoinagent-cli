# AgentSats

AgentSats is a CLI for Bitcoin-paid agent workflows. It exposes explicit human, plain, and JSON output modes so the same commands work interactively for humans and deterministically for machines.

## Use With npx

```bash
npx agentsats --help
npx agentsats services --json
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

Endpoint commands call the Go `bitcoinagent` API. By default they use `BITCOINAGENT_API_URL`, falling back to `https://agentsats.stacksx402.com/`. Every endpoint command also accepts `--api-url <url>`.

To use environment-based wallet configuration, copy the example env file and load it into your shell before running commands:

```bash
cp .env.example .env
set -a
source .env
set +a
```

By default, AgentSats uses `AGENTSATS_WALLET_PROVIDER=private-key` and reads `STACKS_PRIVATE_KEY`. Set it to a funded Stacks private key. Keep wallet secrets out of shell history, docs, and version control.

When a paid endpoint returns a valid x402 v2 `payment-required` challenge for STX on the selected Stacks network, AgentSats signs the facilitator-bound transaction and retries the request once with the `payment-signature` header.

To use an Open Wallet Standard vault wallet instead, set:

```bash
AGENTSATS_WALLET_PROVIDER=ows
OWS_WALLET=agent-treasury
OWS_CHAIN=stacks:1
OWS_CLI=ows
OWS_STACKS_KEY_ENCODING=uncompressed
OWS_PASSPHRASE=
```

`STACKS_NETWORK` defaults to `mainnet`. `OWS_CHAIN` defaults from `STACKS_NETWORK` when unset. Use `stacks:1` for mainnet or `stacks:2147483648` for testnet. `OWS_STACKS_KEY_ENCODING` defaults to `uncompressed`, which matches OWS mnemonic-derived Stacks wallets. Set it to `compressed` only for an imported compressed Stacks private key wallet.

You can also set up an OWS Stacks preview wallet with the explicit setup command:

```bash
npx agentsats wallet setup \
  --provider ows \
  --preview-stacks \
  --wallet agentsats-mainnet \
  --network mainnet \
  --json
```

The command prints this warning:

```text
Stacks support in OWS is still under development.
```

It requires `git` and Rust/Cargo, clones the pinned OWS PR #115 preview into `~/.agentsats/ows/pr-115/<commit>/`, builds the `ows` binary, creates the named OWS wallet when missing, and writes only non-secret wallet config to `~/.agentsats/config.json`. After that, `agentsats wallet` and paid API commands can use the saved OWS config without repeating `OWS_*` environment variables.

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

For the expanded endpoint surface, use either a service command with a relative path or the full-path generic endpoint caller. Service commands are available for `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, and `twitter`.

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

Paid endpoints may return `PAYMENT_REQUIRED` when the API has x402 enforcement enabled and no compatible wallet is configured, signing fails, or the retried paid request is still rejected. In JSON mode the CLI includes decoded `payment-required` challenge metadata in `error.details.paymentRequired`.

## Shell Completions

`@bomb.sh/tab` is wired through the built-in `complete` command added in `src/completions/tab.ts`.

Generate a completion script:

```bash
npx agentsats complete zsh > ~/.agentsats-completion.zsh
npx agentsats complete bash > ~/.agentsats-completion.bash
```

Install it in your shell startup file:

```bash
echo 'source ~/.agentsats-completion.zsh' >> ~/.zshrc
source ~/.zshrc
```

If the package is installed globally or linked into your shell `PATH`, this also works:

```bash
agentsats complete zsh > ~/.agentsats-completion.zsh
```
