# JSON Contracts

## `CliResponse<T>` — Top-Level Shape

All JSON output conforms to this type (defined in `src/types/output.ts`):

```typescript
type CliResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    mode: OutputMode  // always 'json' when emitted in json mode
  }
}
```

### Rules

- Exactly one JSON object per stdout line.
- No trailing newlines beyond the single `\n` written by `writeJson()`.
- `success` is always present and is `true` or `false`.
- On success: `data` is present, `error` is absent.
- On failure: `error` is present, `data` is absent.
- `meta.timestamp` is an ISO 8601 string.
- `meta.mode` is always `"json"` when emitted from JSON-mode rendering.
- `error.code` is one of: `"VALIDATION_ERROR"`, `"NOT_FOUND"`, `"INTERNAL_ERROR"`.
- `error.details` is optional and only present when the original error provides it.

---

## Success Examples

### `run --task "draft plan" --json`

```json
{
  "success": true,
  "data": {
    "taskId": "task_draft_plan",
    "task": "draft plan",
    "status": "completed",
    "summary": "Completed fake agent task: draft plan",
    "steps": ["validate input", "plan work", "report completion"],
    "timestamp": "2026-04-16T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### `status --id "task_draft_plan" --json`

```json
{
  "success": true,
  "data": {
    "taskId": "task_draft_plan",
    "status": "completed",
    "progress": 100,
    "summary": "Task task_draft_plan is completed.",
    "timestamp": "2026-04-16T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### `status --id "task_build_running" --json`

```json
{
  "success": true,
  "data": {
    "taskId": "task_build_running",
    "status": "running",
    "progress": 55,
    "summary": "Task task_build_running is running.",
    "timestamp": "2026-04-16T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

---

## Error Examples

### Validation error (missing `--task`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "required option '--task <string>' not specified"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### Validation error (blank `--task`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid command input.",
    "details": { "fieldErrors": { "task": { "0": { "code": "too_small", "message": "Task is required." } } } }
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### Validation error (`--json --help`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Help output is not available with --json. Use --plain or omit --json."
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### Not found error (`status --id missing --json`)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task 'missing' was not found."
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### Internal error (`status --id explode --json`)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred.",
    "details": { "cause": "Synthetic failure for tests" }
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

---

## Data Types

### `RunCommandResult`

```typescript
{
  taskId: string        // "task_<slug>"
  task: string          // original task string (trimmed)
  status: 'completed'  // always 'completed' in current implementation
  summary: string       // "Completed fake agent task: <task>"
  steps: string[]       // fixed: ['validate input', 'plan work', 'report completion']
  timestamp: string     // ISO 8601
}
```

### `StatusCommandResult`

```typescript
{
  taskId: string            // provided ID (trimmed)
  status: 'queued' | 'running' | 'completed'
  progress: number          // 0 | 55 | 100 depending on status
  summary: string           // "Task <id> is <status>."
  timestamp: string         // ISO 8601
}
```

### `CliErrorPayload`

```typescript
{
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR'
  message: string
  details?: unknown         // Zod flattened errors, error cause, etc.
}
```

---

## Invariants

1. **Single line**: JSON output is always exactly one line on stdout, terminated by `\n`.
2. **No stderr on success**: When `success === true`, stderr must be empty.
3. **No banner in JSON**: The ASCII banner is never included in JSON or plain output.
4. **Deterministic timestamps**: When `now` is injected, timestamps are fully deterministic.
5. **Mode always matches**: `meta.mode` is always `"json"` in JSON-mode output.
6. **No extra fields**: Do not add fields to `CliResponse<T>` without updating the type and tests.
