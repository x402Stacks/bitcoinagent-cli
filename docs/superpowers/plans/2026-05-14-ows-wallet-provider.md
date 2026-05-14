# OWS Wallet Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add selectable private-key and Open Wallet Standard wallet providers to AgentSats.

**Architecture:** Keep commands thin and move wallet-source behavior into services. The wallet command asks a resolver for wallet info, while provider-specific code handles env validation, private-key derivation, OWS CLI execution, and OWS output parsing. Runtime options get an injectable command runner so tests can exercise OWS without a real vault or binary.

**Tech Stack:** TypeScript ESM, Commander, Zod, Vitest, Node child_process, existing `x402-stacks`.

---

## File Structure

- Modify `src/types/context.ts`: add an optional command runner to runtime options.
- Modify `src/types/commands.ts`: add `provider` to wallet results.
- Modify `src/core/stacks-config.ts`: parse wallet provider and OWS config.
- Create `src/services/command-runner.ts`: default async command runner around `node:child_process`.
- Replace `src/services/wallet-service.ts`: expose async wallet resolution and OWS parsing helpers.
- Modify `src/commands/wallet.ts`: await the resolver and pass runtime runner.
- Modify `src/output/human.ts`: include provider in plain and human wallet output.
- Modify `src/cli.ts`: provide a default command runner through resolved runtime.
- Modify `.env.example` and `README.md`: document wallet provider config.
- Modify `test/cli-wallet.test.ts`, `test/cli-json.test.ts`, and `test/env-example.test.ts`: cover behavior.

### Task 1: Extend Runtime And Wallet Result Types

**Files:**
- Modify: `src/types/context.ts`
- Modify: `src/types/commands.ts`

- [x] **Step 1: Write the failing type-level behavior through tests**

Add this assertion to `test/cli-wallet.test.ts` inside the first JSON-mode test:

```ts
expect(payload.data.provider).toBe('private-key')
```

- [x] **Step 2: Run the wallet test to verify it fails**

Run: `pnpm test test/cli-wallet.test.ts`

Expected: FAIL because `payload.data.provider` is `undefined`.

- [x] **Step 3: Add the result and runtime types**

In `src/types/context.ts`, add:

```ts
export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: {
    env?: NodeJS.ProcessEnv
  },
) => Promise<{
  stdout: string
  stderr: string
}>
```

Then add `commandRunner?: CommandRunner` to `RuntimeOptions`.

In `src/types/commands.ts`, change `WalletCommandResult` to:

```ts
export type WalletProvider = 'private-key' | 'ows'

export type WalletCommandResult = {
  address: string
  network: 'mainnet' | 'testnet'
  provider: WalletProvider
  timestamp: string
}
```

- [x] **Step 4: Run typecheck to verify the new types compile**

Run: `pnpm typecheck`

Expected: FAIL until call sites populate `provider`.

### Task 2: Parse Wallet Provider Config

**Files:**
- Modify: `src/core/stacks-config.ts`
- Test: `test/cli-wallet.test.ts`

- [x] **Step 1: Write failing config tests**

Add tests to `test/cli-wallet.test.ts`:

```ts
it('preserves private-key behavior when provider is explicit', async () => {
  const result = await execute(['wallet', '--json'], {
    AGENTSATS_WALLET_PROVIDER: 'private-key',
    STACKS_PRIVATE_KEY: TEST_PRIVATE_KEY,
  })
  const payload = JSON.parse(result.stdout)

  expect(result.exitCode).toBe(0)
  expect(payload.data.provider).toBe('private-key')
  expect(payload.data.address).toMatch(/^ST[0-9A-Z]+$/)
})

it('returns validation error for an invalid wallet provider', async () => {
  const result = await execute(['wallet', '--json'], {
    AGENTSATS_WALLET_PROVIDER: 'hardware',
  })
  const payload = JSON.parse(result.stdout)

  expect(result.exitCode).toBe(1)
  expect(payload.error.code).toBe('VALIDATION_ERROR')
  expect(payload.error.message).toContain('AGENTSATS_WALLET_PROVIDER')
})

it('returns validation error when OWS wallet name is missing', async () => {
  const result = await execute(['wallet', '--json'], {
    AGENTSATS_WALLET_PROVIDER: 'ows',
  })
  const payload = JSON.parse(result.stdout)

  expect(result.exitCode).toBe(1)
  expect(payload.error.code).toBe('VALIDATION_ERROR')
  expect(payload.error.message).toContain('OWS_WALLET')
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test test/cli-wallet.test.ts`

Expected: FAIL because provider parsing is not implemented.

- [x] **Step 3: Implement config parsing**

Add provider types and config functions to `src/core/stacks-config.ts`:

```ts
export type WalletProvider = 'private-key' | 'ows'

export interface OwsWalletConfig {
  provider: 'ows'
  wallet: string
  chain: string
  network: StacksNetwork
  cliPath: string
}

export type WalletConfig = StacksConfig | OwsWalletConfig
```

Add a `readWalletConfig(env)` function that returns private-key config by default and validates `AGENTSATS_WALLET_PROVIDER`, `OWS_WALLET`, `STACKS_NETWORK`, `OWS_CHAIN`, and `OWS_CLI`.

- [x] **Step 4: Run tests**

Run: `pnpm test test/cli-wallet.test.ts`

Expected: provider config tests still fail until wallet service uses `readWalletConfig`.

### Task 3: Add Command Runner And Wallet Providers

**Files:**
- Create: `src/services/command-runner.ts`
- Modify: `src/services/wallet-service.ts`
- Modify: `src/cli.ts`
- Modify: `src/commands/wallet.ts`
- Test: `test/cli-wallet.test.ts`

- [x] **Step 1: Write failing OWS provider test**

Update the local `execute` helper in `test/cli-wallet.test.ts` to accept runtime overrides. Add:

```ts
it('returns the selected OWS Stacks account from wallet list output', async () => {
  const result = await execute(
    ['wallet', '--json'],
    {
      AGENTSATS_WALLET_PROVIDER: 'ows',
      OWS_WALLET: 'agent-treasury',
      STACKS_NETWORK: 'mainnet',
    },
    {
      commandRunner: async () => ({
        stdout: [
          'ID:      wallet-1',
          'Name:    agent-treasury',
          'Secured: yes',
          '  stacks:1 (stacks) -> SP1234567890ABCDEFGHJKMNPQRSTVWXYZ',
          'Created: 2026-05-14T00:00:00Z',
          '',
        ].join('\n'),
        stderr: '',
      }),
    },
  )
  const payload = JSON.parse(result.stdout)

  expect(result.exitCode).toBe(0)
  expect(payload.data.provider).toBe('ows')
  expect(payload.data.network).toBe('mainnet')
  expect(payload.data.address).toBe('SP1234567890ABCDEFGHJKMNPQRSTVWXYZ')
})
```

- [x] **Step 2: Run tests to verify failure**

Run: `pnpm test test/cli-wallet.test.ts`

Expected: FAIL because runtime command injection and OWS parsing are not implemented.

- [x] **Step 3: Implement default command runner**

Create `src/services/command-runner.ts` with an async `runCommand` using `execFile` from `node:child_process`, converting failures into `InternalError` with command, exit code, stdout, and stderr details.

- [x] **Step 4: Wire runtime command runner**

In `src/cli.ts`, import `runCommand` and set `commandRunner: options.commandRunner ?? runCommand` in `resolveRuntime`.

- [x] **Step 5: Implement wallet provider resolution**

Replace `getWalletInfo(config, timestamp)` with:

```ts
export async function getWalletInfo(
  env: NodeJS.ProcessEnv,
  timestamp: string,
  commandRunner: CommandRunner,
): Promise<WalletCommandResult>
```

Private-key provider uses `privateKeyToAccount`. OWS provider runs `commandRunner(cliPath, ['wallet', 'list'], { env })`, parses the block where `Name:` equals `OWS_WALLET`, and extracts the line beginning with the configured OWS chain. Accept both Unicode arrow and ASCII `->` separators.

- [x] **Step 6: Update wallet command**

In `src/commands/wallet.ts`, replace `readStacksConfig` and sync `getWalletInfo` calls with:

```ts
const result = await getWalletInfo(context.env, timestamp, runtime.commandRunner)
```

- [x] **Step 7: Run wallet tests**

Run: `pnpm test test/cli-wallet.test.ts`

Expected: PASS.

### Task 4: Render And Document Provider

**Files:**
- Modify: `src/output/human.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `test/cli-human.test.ts`
- Test: `test/env-example.test.ts`

- [x] **Step 1: Write failing output/docs tests**

Add to `test/cli-human.test.ts` plain wallet test:

```ts
expect(result.stdout).toContain('provider: private-key')
```

Add to `test/env-example.test.ts`:

```ts
expect(envExample).toContain('AGENTSATS_WALLET_PROVIDER=')
expect(envExample).toContain('OWS_WALLET=')
expect(envExample).toContain('OWS_CHAIN=')
expect(envExample).toContain('OWS_CLI=')
```

- [x] **Step 2: Run tests to verify failure**

Run: `pnpm test test/cli-human.test.ts test/env-example.test.ts`

Expected: FAIL because provider is not rendered or documented.

- [x] **Step 3: Update renderers and docs**

In `renderWalletResult`, include `provider` in plain lines and the human note. Add env examples and README examples for both providers.

- [x] **Step 4: Run targeted tests**

Run: `pnpm test test/cli-human.test.ts test/env-example.test.ts test/cli-wallet.test.ts test/cli-json.test.ts`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All changed files

- [x] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [x] **Step 3: Inspect git diff**

Run: `git diff --stat && git diff --check`

Expected: no whitespace errors and only scoped wallet-provider changes.

- [x] **Step 4: Commit implementation**

Run:

```bash
git add .env.example README.md src test docs/superpowers/plans/2026-05-14-ows-wallet-provider.md
git commit -m "feat: add OWS wallet provider"
```
