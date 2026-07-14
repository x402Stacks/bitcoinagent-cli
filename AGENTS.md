# AGENTS.md

Instructions for AI agents working on this codebase.

## Project Overview

`agentsats` (AgentSats) is a production-ready TypeScript ESM CLI for Bitcoin-paid agent workflows. It provides three explicit output modes — **human**, **plain**, and **json** — so the same commands work interactively for humans and deterministically for machines.

- **Package**: `agentsats` (v0.1.0)
- **Runtime**: Node.js >= 20.10.0
- **Module**: ESM only (`"type": "module"`)
- **Language**: TypeScript (strict)
- **Package manager**: pnpm 10.18.3
- **Repo**: https://github.com/x402Stacks/agentsats

## Commands

```bash
pnpm install          # install dependencies
pnpm dev ...          # run via tsx (e.g. pnpm dev services --json)
pnpm build            # tsc compile to dist/
pnpm test             # vitest run
pnpm typecheck        # tsc --noEmit
pnpm lint             # placeholder (not configured)
pnpm completions:generate  # build + run complete command
```

## AgentSats CLI Skill

When using or changing the CLI, including Open Wallet Standard preview setup for Stacks and x402 Stacks payments through OWS, read the project-level skill at `SKILL.md`.

The preview warning text is:

```text
Stacks support in OWS is still under development.
```

## Architecture

```
src/
├── index.ts              # entrypoint (#!/usr/bin/env node)
├── cli.ts                # program creation, runtime wiring, help/JSON-help handling
├── commands/
│   ├── api.ts            # bitcoinagent API endpoint commands
│   └── wallet.ts        # Stacks wallet command
├── completions/
│   └── tab.ts            # @bomb.sh/tab shell completion integration
├── core/
│   ├── api-config.ts     # bitcoinagent API base URL helpers
│   ├── errors.ts         # CliError hierarchy (ValidationError, NotFoundError, PaymentRequiredError, InternalError, FeeTooHighError)
│   ├── exit.ts           # exit code mapping by error code
│   ├── logger.ts         # logger suppressed in JSON mode
│   └── env.ts            # environment helpers (CI, NO_COLOR)
├── output/
│   ├── agent.ts          # structured JSON response helpers (createSuccessResponse, createErrorResponse)
│   └── human.ts          # human/plain renderers + ASCII banner (human-only)
├── services/
│   ├── bitcoinagent-api.ts # HTTP client for Go bitcoinagent endpoints
│   ├── stacks-client.ts  # x402-stacks payment client factory
│   ├── x402-payment.ts   # x402 STX payment signing; fee cap via AGENTSATS_MAX_FEE_USTX,
│   │                     # AGENTSATS_FEE_MAX_RETRIES, AGENTSATS_FEE_RETRY_DELAY_MS (fails closed)
│   └── wallet-service.ts # Stacks wallet derivation
├── types/
│   ├── output.ts         # OutputMode, CliResponse<T>
│   ├── context.ts        # Writer, RuntimeOptions, TerminalInfo, CommandContext
│   └── commands.ts       # Wallet/API command result types
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
8. **API endpoint commands**: endpoint commands call `BITCOINAGENT_API_URL` or `https://agentsats.stacksx402.com/`, support `--api-url`, and return decoded x402 `payment-required` challenge metadata as `PAYMENT_REQUIRED`. Use service-scoped commands (`airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitter`) or `api-call` for full expanded API coverage, including newer GET/POST endpoints discovered through `service-endpoints`.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^13.1.0 | CLI framework (v13, not v14 — for @bomb.sh/tab compat) |
| @clack/prompts | ^1.2.0 | Human UX (spinner, log, note) |
| @bomb.sh/tab | ^0.0.14 | Shell completions |
| zod | ^4.3.6 | Input validation |
| tsx | ^4.21.0 | Dev runner |
| vitest | ^4.1.4 | Tests |
| typescript | ^6.0.2 | Compiler |

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
