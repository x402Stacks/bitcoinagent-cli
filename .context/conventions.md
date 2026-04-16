# Coding Conventions and Style Rules

## Module System

- ESM only. All imports use `.js` extensions (`import { x } from './foo.js'`).
- `"type": "module"` in package.json.
- No CommonJS (`require`, `module.exports`).

## TypeScript

- Strict mode enabled (`strict: true`).
- No `any` types. Use `unknown` and narrow.
- Prefer interfaces for object types, type aliases for unions/intersections.
- Use `readonly` for immutable properties where appropriate.
- Export individual symbols; avoid barrel files.
- Use `type` imports for type-only references: `import type { X } from 'y'`.

## Naming

- Files: `kebab-case.ts` — matches directory structure.
- Directories: `kebab-case/`.
- Classes: `PascalCase` (e.g., `CliError`, `ValidationError`).
- Functions: `camelCase` (e.g., `resolveOutputMode`, `createCommandContext`).
- Constants: `UPPER_SNAKE_CASE` for true constants (e.g., `HUMAN_BANNER`), `camelCase` for function-scoped values.
- Types/Interfaces: `PascalCase` (e.g., `OutputMode`, `CommandContext`, `CliResponse`).
- Command registration functions: `registerXxxCommand` (e.g., `registerRunCommand`).

## File Organization

- One export per file preferred; related helpers can share a file.
- `types/` contains only type definitions — no runtime code.
- `core/` contains fundamental abstractions shared across the entire CLI.
- `utils/` contains pure utility functions with no business logic.
- `services/` contains business logic — must not import from `output/` or `commands/`.
- `commands/` contains thin handlers that validate and delegate.
- `output/` contains all rendering — the only place that writes to the terminal.

## Error Handling

- Always throw `CliError` subclasses, never raw `Error`.
- Use `normalizeError()` at the catch boundary to convert unknown errors.
- Never catch and swallow errors silently — either rethrow or render and return exit code.
- Service layer throws domain errors (`NotFoundError`, `ValidationError`). Command layer normalizes and renders.

## Output Rules

- **Never use `console.log`**. Use the logger (`createLogger`) or output helpers (`writeJson`, `renderJsonSuccess`, etc.).
- **Never emit to stdout outside of `output/`**. Commands delegate to renderers; services return data.
- **JSON mode**: exactly one JSON line on stdout, empty stderr on success. No exceptions.
- **Plain mode**: key-value lines, no spinner, no banner, no color.
- **Human mode**: Clack UX (spinner, log, note) + banner. Full polish.

## Import Order

1. Node builtins (`node:stream`, `node:util`, etc.)
2. External packages (`commander`, `zod`, `@clack/prompts`)
3. Internal modules (`../core/`, `../types/`, `../utils/`, `../services/`, `../output/`)

Separate groups with blank lines.

## Testing

- Framework: Vitest.
- Test files live in `test/`, not `src/`.
- Use `createMemoryWriter()` pattern for stdout/stderr capture.
- Always inject `now: () => '<fixed-timestamp>'` for deterministic JSON output.
- JSON tests assert: single line on stdout, empty stderr, correct `CliResponse` shape.
- Write JSON-mode tests first when adding new commands.

## Dependencies

- Prefer built-in Node.js APIs over third-party packages.
- Do not add dependencies without checking if an existing one already provides the capability.
- `commander@13` (not v14) is pinned for `@bomb.sh/tab` compatibility.
- Clack (`@clack/prompts`) is the UI layer. Do not use Ink or any other TUI framework.

## Comments

- Avoid comments that restate what the code does.
- Comments are acceptable for: non-obvious business rules, why-not-what explanations, and links to external references.
- Doc comments on exported functions/types are welcome.

## Formatting

- 2-space indentation.
- Semicolons required.
- Single quotes for strings, double quotes only when required by content.
- Trailing commas in multi-line collections.
