# Command Reference

## Global Options

| Flag | Description |
|------|-------------|
| `--version` | Print version (`0.1.0`) and exit |
| `--help`, `-h` | Print help and exit (code 0) |
| `help <command>` | Print subcommand help and exit (code 0) |

### Help with JSON

`--json --help` or `--help --json` is explicitly rejected with a `VALIDATION_ERROR` because help text is not machine-parseable. The error is returned as structured JSON:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Help output is not available with --json. Use --plain or omit --json."
  },
  "meta": { "timestamp": "...", "mode": "json" }
}
```

Exit code: 1.

---

## `run` — Run a fake agent task

### Usage

```
agent-cli run --task <string> [--json] [--plain] [--non-interactive]
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--task <string>` | Yes | Task description (trimmed, must be non-empty) |
| `--json` | No | Emit structured JSON only |
| `--plain` | No | Emit minimal readable text |
| `--non-interactive` | No | Disable prompts for automation |

### Validation

- `--task` is required. Missing → `VALIDATION_ERROR`.
- `--task` value is trimmed and must have length >= 1 after trimming. Blank string → `VALIDATION_ERROR`.

### Service Behavior

`runAgentTask(task, timestamp)` is deterministic:
- Task ID is derived: `task_<slug>` where slug is the lowercase, non-alphanumeric-collapsed version of the task string.
- Status is always `'completed'`.
- Steps are always `['validate input', 'plan work', 'report completion']`.
- Summary: `"Completed fake agent task: <task>"`.

### Output by Mode

**Human mode** (default):
1. ASCII banner
2. Clack spinner: "Running fake agent task" → "Task complete"
3. `log.success` with task ID
4. `note` with task, status, summary, steps, timestamp

**Plain mode** (`--plain`):
```
taskId: task_draft_plan
task: draft plan
status: completed
summary: Completed fake agent task: draft plan
steps: validate input, plan work, report completion
timestamp: 2026-04-16T00:00:00.000Z
```

**JSON mode** (`--json`):
```json
{"success":true,"data":{"taskId":"task_draft_plan","task":"draft plan","status":"completed","summary":"Completed fake agent task: draft plan","steps":["validate input","plan work","report completion"],"timestamp":"2026-04-16T00:00:00.000Z"},"meta":{"timestamp":"2026-04-16T00:00:00.000Z","mode":"json"}}
```

Exit code: 0 on success, 1 on validation/internal error.

---

## `status` — Read fake status for a task

### Usage

```
agent-cli status --id <string> [--json] [--plain]
```

### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--id <string>` | Yes | Task identifier (trimmed, must be non-empty) |
| `--json` | No | Emit structured JSON only |
| `--plain` | No | Emit minimal readable text |

### Validation

- `--id` is required. Missing → `VALIDATION_ERROR`.
- `--id` value is trimmed and must have length >= 1 after trimming.

### Service Behavior

`getAgentTaskStatus(id, timestamp)`:
- `id === 'explode'` → throws `Error` (synthetic failure, results in `INTERNAL_ERROR`).
- `id === 'missing'` → throws `NotFoundError`.
- Otherwise, status is derived from the ID suffix:
  - Ends with `_queued` → status: `'queued'`, progress: 0
  - Ends with `_running` → status: `'running'`, progress: 55
  - Otherwise → status: `'completed'`, progress: 100
- Summary: `"Task <id> is <status>."`

### Output by Mode

**Human mode** (default):
1. ASCII banner
2. Clack spinner: "Checking task status" → "Status loaded"
3. `log.success` with task ID
4. `note` with status, progress, summary, timestamp

**Plain mode** (`--plain`):
```
taskId: task_draft_plan
status: completed
progress: 100
summary: Task task_draft_plan is completed.
timestamp: 2026-04-16T00:00:00.000Z
```

**JSON mode** (`--json`):
```json
{"success":true,"data":{"taskId":"task_draft_plan","status":"completed","progress":100,"summary":"Task task_draft_plan is completed.","timestamp":"2026-04-16T00:00:00.000Z"},"meta":{"timestamp":"2026-04-16T00:00:00.000Z","mode":"json"}}
```

Exit code: 0 on success, 1 on validation/internal error, 2 on not-found.

---

## `complete` — Shell completion generation

### Usage

```
agent-cli complete <shell>
```

Supported shells: `zsh`, `bash`, `fish` (via `@bomb.sh/tab`).

This is registered automatically by `registerCompletionSupport(program)` in `src/completions/tab.ts`.

---

## Exit Code Summary

| Code | Meaning |
|------|---------|
| 0 | Success (including clean help exit) |
| 1 | Validation error or internal error |
| 2 | Not found |

## Mode Priority

`--json` takes precedence over `--plain`. If neither is specified, mode is `human`.

```
resolveOutputMode({ json: true, plain: true })  → 'json'
resolveOutputMode({ plain: true })               → 'plain'
resolveOutputMode({})                             → 'human'
```
