# Architecture

## Directory Structure

```
agentsats/
├── src/
│   ├── index.ts              # Entrypoint — calls runCli(), sets process.exitCode
│   ├── cli.ts                # Program factory, runtime resolution, error/help handling
│   ├── commands/
│   │   ├── api.ts            # bitcoinagent API endpoint commands
│   │   └── wallet.ts        # wallet command — Stacks address derivation
│   ├── completions/
│   │   └── tab.ts            # @bomb.sh/tab integration (registers `complete` subcommand)
│   ├── core/
│   │   ├── api-config.ts     # bitcoinagent API base URL resolution
│   │   ├── errors.ts         # CliError hierarchy + normalizeError()
│   │   ├── exit.ts           # getExitCode() — maps error codes to exit codes
│   │   ├── logger.ts         # Logger factory — no-op in json mode
│   │   └── env.ts            # readEnvironment() — CI and NO_COLOR detection
│   ├── output/
│   │   ├── agent.ts          # JSON helpers: createSuccessResponse, createErrorResponse, renderJson*
│   │   └── human.ts          # Human/plain renderers + ASCII banner (human-only)
│   ├── services/
│   │   ├── bitcoinagent-api.ts # HTTP client for bitcoinagent API endpoints
│   │   ├── stacks-client.ts  # x402-stacks client factory
│   │   └── wallet-service.ts # Stacks wallet derivation
│   ├── types/
│   │   ├── output.ts         # OutputMode, CliErrorPayload, CliResponse<T>
│   │   ├── context.ts        # Writer, RuntimeOptions, TerminalInfo, CommandContext
│   │   └── commands.ts       # Wallet/API command option and result types
│   └── utils/
│       ├── json.ts           # safeJsonStringify, writeJson
│       ├── mode.ts           # resolveOutputMode (json > plain > human)
│       └── terminal.ts       # getTerminalInfo, createCommandContext, toNodeWritable
├── test/
│   ├── cli-json.test.ts      # JSON mode contract tests
│   ├── cli-human.test.ts    # Banner/human mode tests
│   └── mode.test.ts         # resolveOutputMode unit tests
├── .context/                 # Deep reference docs (this directory)
├── AGENTS.md                 # Agent context summary
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Data Flow

### Normal Execution

```
index.ts
  └── runCli(argv, runtimeOptions)
        ├── resolveRuntime(options)          → ResolvedRuntime (stdout, stderr, stdin, now, exitCode)
        ├── createCommandContext(flags, runtime) → CommandContext (mode, terminal, writers, now)
        ├── [json + help guard]              → returns VALIDATION_ERROR if --json --help
        ├── createProgram(runtime)           → Commander program with all commands registered
        └── program.parseAsync(argv)         → Commander dispatches to command handler
              └── handleWallet / handleApiCommand
                    ├── Zod validation of options
                    ├── Service call (wallet derivation or bitcoinagent API)
                    ├── Mode-based rendering:
                    │     json  → renderJsonSuccess / renderJsonError
                    │     plain → renderPlainBlock
                    │     human → renderBanner + Clack spinner/note
                    └── Return exit code
```

### Error Flow

```
Any thrown error
  └── normalizeError(error)                → CliError (ValidationError | NotFoundError | InternalError)
        ├── CliError instance               → returned as-is
        ├── ZodError                        → ValidationError('Invalid command input.', flattened)
        ├── CommanderError                  → ValidationError(commander.message)
        ├── Error                           → InternalError(undefined, { cause: message })
        └── unknown                         → InternalError(undefined, { cause: value })
  └── Mode-based rendering:
        json  → renderJsonError(context, normalized, timestamp)
        else  → renderFriendlyError(context, normalized)
  └── getExitCode(normalized)              → 1 (VALIDATION/INTERNAL) or 2 (NOT_FOUND)
```

### Help Flow

```
--help / -h / help <cmd>
  ├── JSON mode active?
  │     └── VALIDATION_ERROR: "Help output is not available with --json"
  └── Commander catches, throws CommanderError(code: 'commander.helpDisplayed')
        └── isSuccessfulHelpExit(error) === true → return exit code 0
```

## Key Modules

### `src/cli.ts`

Central orchestrator. Responsibilities:
- `resolveRuntime()` — fills in defaults for stdout/stderr/stdin/now
- `createProgram()` — creates Commander program, wires output, registers all commands and completion support
- `isSuccessfulHelpExit()` — identifies Commander help exits that should be treated as success
- `isHelpRequest()` — detects `--help`, `-h`, or `help` in argv
- `runCli()` — main entry: resolves runtime, guards json+help, runs program, catches and normalizes errors
- `createCli()` — exposed for testing (creates program without running it)

### `src/output/agent.ts`

JSON response factory:
- `createSuccessResponse(data, mode, timestamp)` → `{ success: true, data, meta: { timestamp, mode } }`
- `createErrorResponse(error, mode, timestamp)` → `{ success: false, error: { code, message, details? }, meta: { timestamp, mode } }`
- `renderJsonSuccess(context, data, timestamp)` → writes one JSON line to stdout
- `renderJsonError(context, error, timestamp)` → writes one JSON error line to stdout

### `src/output/human.ts`

Human/plain rendering:
- `HUMAN_BANNER` — ASCII art logo string, rendered only in human mode
- `renderBanner(context)` — writes banner to stdout via toNodeWritable
- `renderWalletResult(context, result)` — plain mode: key-value lines; human mode: banner + wallet note
- `renderApiEndpointResult(context, result)` — plain mode: key-value lines; human mode: banner + API note
- `renderFriendlyError(context, error)` — plain mode: logger error; human mode: Clack log.error + note for details

### `src/commands/api.ts`

Registers all HTTP endpoint commands for the Go `bitcoinagent` API:
- `health`
- `services`
- `service-endpoints`
- `api-call`
- Service-scoped commands: `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitch`, `twitter`, `zillow`
- `tiktok-profile`
- `tiktok-videos`
- `twitter-profile`
- `twitter-highlights`
- `twitter-tweets`
- `twitter-followings`

Each command supports `--api-url`, `--json`, and `--plain`. Commands validate flags with Zod, resolve the API base URL through `readBitcoinAgentApiConfig()`, delegate HTTP work to `services/bitcoinagent-api.ts`, and render through shared output helpers. Service-scoped commands and `api-call` cover the expanded API surface; they support `GET`, `POST`, repeated `--query key=value`, and `--body-json`.

### `src/services/bitcoinagent-api.ts`

HTTP client for the Go API. It:
- Builds `GET` and `POST` requests from the configured base URL
- Unwraps API success envelopes into `ApiEndpointResult.response`
- Copies `meta.provider` into `ApiEndpointResult.provider`
- Preserves `/health` as an unenveloped response
- Maps API errors to CLI errors
- Decodes base64 JSON `payment-required` headers into `PAYMENT_REQUIRED` details

### `src/core/errors.ts`

Error hierarchy:
- `CliError(code, message, details?)` — base class with typed ErrorCode
- `ValidationError` — code `VALIDATION_ERROR`, exit code 1
- `NotFoundError` — code `NOT_FOUND`, exit code 2
- `InternalError` — code `INTERNAL_ERROR`, exit code 1
- `normalizeError(error)` — converts any thrown value into a CliError subclass

### `src/core/exit.ts`

- `getExitCode(error)` — maps: `NOT_FOUND` → 2, everything else → 1

### `src/core/logger.ts`

- `createLogger(mode, stdout, stderr)` — returns no-op logger when mode is `json`, real logger otherwise
- Logger methods: `info` → stdout, `warn`/`error` → stderr

### `src/utils/mode.ts`

- `resolveOutputMode({ json?, plain? })` — json wins over plain; default is `human`

### `src/utils/terminal.ts`

- `getTerminalInfo(stdin, stdout, stderr)` — detects TTY status and CI environment
- `createCommandContext(flags, runtime)` — resolves mode, terminal info, and assembles CommandContext
- `toNodeWritable(writer)` — adapts Writer interface to Node.js Writable stream (needed by Clack)

### `src/completions/tab.ts`

- `registerCompletionSupport(program)` — calls `tab(program)` from `@bomb.sh/tab/commander`

## Runtime Options Injection

Tests and programmatic callers inject `RuntimeOptions` to control:
- `stdout` / `stderr` — custom Writer implementations (e.g., `createMemoryWriter()`)
- `stdin` — readable stream
- `now` — deterministic timestamp function

This is how tests achieve deterministic output without mocking timers.
