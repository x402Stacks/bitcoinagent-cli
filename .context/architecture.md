# Architecture

## Directory Structure

```
agent-cli/
├── src/
│   ├── index.ts              # Entrypoint — calls runCli(), sets process.exitCode
│   ├── cli.ts                # Program factory, runtime resolution, error/help handling
│   ├── commands/
│   │   ├── run.ts            # run command — Zod schema + handler + registration
│   │   └── status.ts        # status command — Zod schema + handler + registration
│   ├── completions/
│   │   └── tab.ts            # @bomb.sh/tab integration (registers `complete` subcommand)
│   ├── core/
│   │   ├── errors.ts         # CliError hierarchy + normalizeError()
│   │   ├── exit.ts           # getExitCode() — maps error codes to exit codes
│   │   ├── logger.ts         # Logger factory — no-op in json mode
│   │   └── env.ts            # readEnvironment() — CI and NO_COLOR detection
│   ├── output/
│   │   ├── agent.ts          # JSON helpers: createSuccessResponse, createErrorResponse, renderJson*
│   │   └── human.ts          # Human/plain renderers + ASCII banner (human-only)
│   ├── services/
│   │   └── agent-service.ts  # Deterministic fake business logic
│   ├── types/
│   │   ├── output.ts         # OutputMode, CliErrorPayload, CliResponse<T>
│   │   ├── context.ts        # Writer, RuntimeOptions, TerminalInfo, CommandContext
│   │   └── commands.ts       # Run/Status command option and result types
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
              └── handleRun / handleStatus
                    ├── Zod validation of options
                    ├── Service call (runAgentTask / getAgentTaskStatus)
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

### `src/commands/run.ts` & `src/commands/status.ts`

Thin command modules. Each:
- Defines a Zod schema for its input
- Provides `getRawFlags()` to extract json/plain/nonInteractive flags from Commander options
- Implements `handleRun/handleStatus()` with try/catch → normalize → render → exit code
- Exports `registerRunCommand/registerStatusCommand()` to attach to the Commander program

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
- `renderRunResult(context, result)` — plain mode: key-value lines; human mode: banner + spinner + note
- `renderStatusResult(context, result)` — plain mode: key-value lines; human mode: banner + log + note
- `renderFriendlyError(context, error)` — plain mode: logger error; human mode: Clack log.error + note for details

### `src/services/agent-service.ts`

Deterministic fake business logic:
- `toTaskId(value)` — normalizes task string to `task_<slug>` format
- `runAgentTask(task, timestamp)` → RunCommandResult (always status: 'completed')
- `getDerivedStatus(taskId)` — derives state from task ID suffix (`_queued`, `_running`, else `completed`)
- `getAgentTaskStatus(id, timestamp)` → StatusCommandResult
  - `id === 'explode'` → throws Error (for testing INTERNAL_ERROR)
  - `id === 'missing'` → throws NotFoundError (for testing NOT_FOUND)

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
