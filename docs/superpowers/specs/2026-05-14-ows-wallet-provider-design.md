# OWS Wallet Provider Design

## Goal

AgentSats should support two Stacks wallet sources:

- the existing `STACKS_PRIVATE_KEY` environment variable path
- an Open Wallet Standard wallet from the local OWS vault

The private-key path remains the default so existing development flows continue to work. OWS support is opt-in and lets agents use Stacks accounts and signing without exposing raw private keys to AgentSats.

## Configuration

Wallet source is selected with:

```bash
AGENTSATS_WALLET_PROVIDER=private-key
```

or:

```bash
AGENTSATS_WALLET_PROVIDER=ows
OWS_WALLET=agent-treasury
OWS_PASSPHRASE=...
OWS_CHAIN=stacks:2147483648
OWS_CLI=/path/to/ows
```

`private-key` is the default. `STACKS_NETWORK` still accepts `mainnet` or `testnet`.

For OWS, `OWS_WALLET` is required. `OWS_CHAIN` defaults from `STACKS_NETWORK`: `stacks:1` for mainnet and `stacks:2147483648` for testnet. `OWS_CLI` is optional and defaults to `ows` on `PATH`. `OWS_PASSPHRASE` is passed through the environment to OWS when signing.

## Architecture

Add a wallet provider boundary in `src/services/`:

```ts
type StacksWallet = {
  address: string
  network: 'mainnet' | 'testnet'
  provider: 'private-key' | 'ows'
  signTransaction(txHex: string): Promise<string>
}
```

The private-key provider wraps the current `x402-stacks` behavior. The OWS provider resolves the Stacks address by running `ows wallet list` and parsing the Stacks account line for the selected wallet. Signing uses `ows sign tx --wallet <name> --chain <chain> --tx <hex> --json`.

AgentSats owns request, response, and output rendering. It should not shell out to `ows pay request`, because AgentSats must preserve its strict JSON/plain/human output contracts and the OWS pay flow in the referenced branch remains EVM-oriented.

## Command Behavior

`agentsats wallet` reports the selected provider and Stacks address. JSON output stays a single object on stdout. Plain output stays key-value lines without the banner. Human output keeps the banner.

Endpoint commands continue to call the bitcoinagent API through AgentSats. When x402 Stacks payment signing is added to endpoint retries, it must call the selected wallet provider instead of reading `STACKS_PRIVATE_KEY` directly.

## Error Handling

Invalid `AGENTSATS_WALLET_PROVIDER` is a validation error. Missing `STACKS_PRIVATE_KEY` remains a validation error only for the private-key provider. Missing `OWS_WALLET`, missing OWS CLI, malformed OWS JSON, and OWS signing failures are normalized into existing CLI errors.

JSON mode must never prompt. If OWS requires interactive input and `OWS_PASSPHRASE` is absent, AgentSats returns a validation error in JSON mode.

## Tests

Add tests before implementation for:

- default private-key provider still returns the current Stacks address and network
- explicit `AGENTSATS_WALLET_PROVIDER=private-key` preserves current behavior
- invalid provider returns `VALIDATION_ERROR`
- OWS provider returns the Stacks account from injected `ows wallet list` output
- missing `OWS_WALLET` returns `VALIDATION_ERROR`
- JSON mode remains exactly one JSON line with empty stderr

Use dependency injection for OWS command execution so tests do not depend on a real OWS vault or installed binary.
