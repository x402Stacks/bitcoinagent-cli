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
```

Human mode is the default. It uses Clack spinners plus readable summaries.

## Run In Plain Mode

```bash
pnpm exec tsx src/index.ts run --task "draft incident report" --plain
pnpm exec tsx src/index.ts status --id task_draft_incident_report --plain
```

Plain mode is minimal readable text with no spinner and no extra decoration.

## Run In JSON Mode

```bash
pnpm exec tsx src/index.ts run --task "draft incident report" --json
pnpm exec tsx src/index.ts status --id task_draft_incident_report --json
```

JSON mode is automation-safe:

- exactly one JSON object on stdout
- no prompts
- no spinner
- no ANSI noise
- no extra logs

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
