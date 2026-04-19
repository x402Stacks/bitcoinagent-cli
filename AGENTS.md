# AGENTS.md

Instructions for AI agents working on this codebase.

## Project Overview

`agent-cli` is a production-ready TypeScript ESM CLI starter designed for agent-first workflows. It provides three explicit output modes — **human**, **plain**, and **json** — so the same commands work interactively for humans and deterministically for machines.

- **Package**: `agent-cli` (v0.1.0)
- **Runtime**: Node.js >= 20.10.0
- **Module**: ESM only (`"type": "module"`)
- **Language**: TypeScript (strict)
- **Package manager**: pnpm 10.18.3
- **Repo**: https://github.com/x402Stacks/bitcoinagent-cli

## Commands

```bash
pnpm install          # install dependencies
pnpm dev ...          # run via tsx (e.g. pnpm dev run --task "x")
pnpm build            # tsc compile to dist/
pnpm test             # vitest run
pnpm typecheck        # tsc --noEmit
pnpm lint             # placeholder (not configured)
pnpm completions:generate  # build + run complete command
```

## Architecture

```
src/
├── index.ts              # entrypoint (#!/usr/bin/env node)
├── cli.ts                # program creation, runtime wiring, help/JSON-help handling
├── commands/
│   ├── run.ts            # run command (registration + validation + execution)
│   ├── status.ts          # status command
│   ├── wallet.ts          # wallet command (Stacks key inspection)
│   ├── services.ts        # services list + endpoints commands (discovery)
│   ├── tiktok.ts          # tiktok profile + videos commands (free)
│   ├── twitter.ts          # twitter profile/tweets/highlights/followings commands (paid, x402)
│   └── health.ts           # health command (raw /health endpoint)
├── completions/
│   └── tab.ts              # @bomb.sh/tab shell completion integration
├── core/
│   ├── errors.ts           # CliError hierarchy (ValidationError, NotFoundError, InternalError, UpstreamError, PaymentRequiredError)
│   ├── exit.ts             # exit code mapping by error code
│   ├── logger.ts           # logger suppressed in JSON mode
│   ├── env.ts              # environment helpers (CI, NO_COLOR)
│   ├── api-config.ts       # API_BASE_URL / API_TIMEOUT_MS config loader
│   └── stacks-config.ts    # STACKS_PRIVATE_KEY / STACKS_NETWORK config loader
├── output/
│   ├── agent.ts            # structured JSON response helpers (createSuccessResponse, createErrorResponse)
│   └── human.ts            # human/plain renderers + ASCII banner (human-only)
├── services/
│   ├── agent-service.ts    # deterministic fake business logic
│   ├── wallet-service.ts   # Stacks wallet info
│   ├── stacks-client.ts   # x402 payment client factory
│   ├── api-client.ts       # free HTTP client (Node fetch, envelope unwrap)
│   ├── paid-api-client.ts  # paid HTTP client (x402 axios, envelope unwrap)
│   ├── api-envelope.ts     # envelope unwrap + error code mapper
│   ├── transport.ts        # transport factory (getFreeTransport, getPaidTransport)
│   ├── services-service.ts # discovery API calls
│   ├── tiktok-service.ts   # TikTok API calls
│   ├── twitter-service.ts  # Twitter API calls
│   └── health-service.ts   # health check API call
├── types/
│   ├── output.ts           # OutputMode, CliResponse<T>
│   ├── context.ts          # Writer, RuntimeOptions, TerminalInfo, CommandContext
│   └── commands.ts         # all command input/result types
└── utils/
    ├── json.ts             # safeJsonStringify, writeJson
    ├── mode.ts             # resolveOutputMode (json > plain > human)
    └── terminal.ts         # getTerminalInfo, createCommandContext, toNodeWritable
```
src/
├── index.ts              # entrypoint (#!/usr/bin/env node)
├── cli.ts                # program creation, runtime wiring, help/JSON-help handling
├── commands/
│   ├── run.ts            # run command (registration + validation + execution)
│   └── status.ts        # status command
├── completions/
│   └── tab.ts            # @bomb.sh/tab shell completion integration
├── core/
│   ├── errors.ts         # CliError hierarchy (ValidationError, NotFoundError, InternalError)
│   ├── exit.ts           # exit code mapping by error code
│   ├── logger.ts         # logger suppressed in JSON mode
│   └── env.ts            # environment helpers (CI, NO_COLOR)
├── output/
│   ├── agent.ts          # structured JSON response helpers (createSuccessResponse, createErrorResponse)
│   └── human.ts          # human/plain renderers + ASCII banner (human-only)
├── services/
│   └── agent-service.ts  # deterministic fake business logic
├── types/
│   ├── output.ts         # OutputMode, CliResponse<T>
│   ├── context.ts        # Writer, RuntimeOptions, TerminalInfo, CommandContext
│   └── commands.ts       # Run/Status command input/result types
└── utils/
    ├── json.ts           # safeJsonStringify, writeJson
    ├── mode.ts           # resolveOutputMode (json > plain > human)
    └── terminal.ts       # getTerminalInfo, createCommandContext, toNodeWritable
```

## Key Design Principles

1. **Three-mode output**: every command must handle `human`, `plain`, and `json` modes. JSON mode is the strictest — exactly one JSON object on stdout, no prompts, no spinner, no ANSI, no extra logs.
2. **Thin commands**: `commands/` files only parse, validate (Zod), and delegate. Business logic lives in `services/`.
3. **Centralized output**: `output/` owns all rendering. Never write directly to stdout outside of output helpers.
4. **Stable JSON contract**: `CliResponse<T>` is `{ success, data?, error?, meta: { timestamp, mode } }`. Never change this shape without updating types and tests.
5. **Logger suppression**: `core/logger.ts` returns no-op methods when mode is `json`. Use the logger, never `console.log`.
6. **Banner**: ASCII logo banner appears in human mode only. Plain and json modes must never emit it.
7. **Help safety**: `--json --help` returns a JSON validation error (code `VALIDATION_ERROR`). Help without `--json` exits cleanly with code 0.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^13.1.0 | CLI framework (v13, not v14 — for @bomb.sh/tab compat) |
| @clack/prompts | ^1.2.0 | Human UX (spinner, log, note) |
| @bomb.sh/tab | ^0.0.14 | Shell completions |
| zod | ^4.3.6 | Input validation |
| x402-stacks | ^1.1.0 | x402 payment client (Stacks) |
| axios | ^1.15.0 | HTTP client (used by paid-api-client) |
| tsx | ^4.21.0 | Dev runner |
| vitest | ^4.1.4 | Tests |
| typescript | ^6.0.2 | Compiler |

## Consuming the API

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3000` | Base URL for the social-platform API |
| `API_TIMEOUT_MS` | `60000` | Request timeout in milliseconds (positive integer) |
| `STACKS_PRIVATE_KEY` | — | Required for paid (Twitter/x402) commands |
| `STACKS_NETWORK` | `testnet` | Stacks network (`mainnet` or `testnet`) |

### Command Tree

```
agent-cli
├── run                  # Agent task runner (fake)
├── status               # Task status (fake)
├── wallet               # Show Stacks wallet address
├── services
│   ├── list             # List API services (free)
│   └── endpoints <name> # Show endpoints for a service (free)
├── tiktok
│   ├── profile          # Fetch TikTok profile (free)
│   └── videos           # List TikTok videos (free)
├── twitter
│   ├── profile          # Fetch Twitter profile (paid)
│   ├── tweets           # List tweets (paid)
│   ├── highlights       # List highlights (paid)
│   └── followings       # List followings (paid)
└── health               # API health check (free)
```

### Error Codes & Exit Codes

| Error Code | Exit Code | When |
|------------|-----------|------|
| `VALIDATION_ERROR` | 1 | Invalid input, missing flags, Zod parse failure |
| `INTERNAL_ERROR` | 1 | Unexpected bugs |
| `NOT_FOUND` | 2 | Resource not found (404) |
| `UPSTREAM_ERROR` | 3 | Upstream provider unavailable (502, network errors) |
| `PAYMENT_REQUIRED` | 4 | Payment required and settlement failed (402) |

## Adding a New Command

1. Add result/input types in `src/types/commands.ts`
2. Add business logic in `src/services/` (new or existing file)
3. Create command module in `src/commands/` with Zod schema, handler, and `registerXxxCommand`
4. Use `createCommandContext`, `resolveOutputMode`, and shared output helpers
5. Register the command in `src/cli.ts`
6. Write JSON-mode tests first in `test/`

## Testing Conventions

- Framework: Vitest
- All JSON-mode tests use `createMemoryWriter()` for stdout/stderr capture
- Tests inject a fixed `now` function (`() => '2026-04-16T00:00:00.000Z'`) for deterministic timestamps
- JSON tests verify: exactly one line on stdout, empty stderr, correct `CliResponse` shape
- Human/banner tests verify: banner present in human mode, absent in plain and json modes

## Critical Invariants

- **JSON mode must emit exactly one JSON line on stdout** — no extra newlines, no banner, no spinner output
- **stderr must be empty in json mode on success** — all output goes to stdout
- **`--json --help` is an error** — help text is not machine-parseable, so it's rejected with a validation error
- **Commander `exitOverride()`** is used — all Commander errors are caught and normalized via `normalizeError()`
- **Do not use `console.log`** — use the logger or output helpers
- **Do not use Ink** — Clack is the UI layer for human mode

## File Paths

When referencing code, use `file_path:line_number` format (e.g., `src/cli.ts:68` for `runCli`).

## Detailed Context

See `.context/` directory for deeper reference:
- `.context/architecture.md` — full architecture diagram and data flow
- `.context/conventions.md` — coding conventions and style rules
- `.context/commands.md` — command reference with all flags and behavior
- `.context/contracts.md` — JSON contract shapes and examples
