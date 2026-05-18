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
- `error.code` is one of: `"VALIDATION_ERROR"`, `"NOT_FOUND"`, `"PAYMENT_REQUIRED"`, `"INTERNAL_ERROR"`.
- `error.details` is optional and only present when the original error provides it.

---

## Success Examples

### `health --json`

```json
{
  "success": true,
  "data": {
    "method": "GET",
    "endpoint": "/health",
    "url": "https://agentsats.stacksx402.com/health",
    "statusCode": 200,
    "response": { "status": "ok" },
    "timestamp": "2026-04-16T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### `wallet --json`

```json
{
  "success": true,
  "data": {
    "address": "SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "network": "mainnet",
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

### Validation error (removed `run` command)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "error: unknown command 'run'"
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

### Validation error (missing `STACKS_PRIVATE_KEY`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "STACKS_PRIVATE_KEY environment variable is required."
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

### Payment required (`twitter-profile --username MrBeast --json`)

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Payment is required for this endpoint.",
    "details": {
      "statusCode": 402,
      "endpoint": "/api/v1/twitter/profile",
      "paymentRequired": {
        "accepts": [
          { "scheme": "exact", "network": "stacks:1", "asset": "STX", "amount": "1000" }
        ]
      }
    }
  },
  "meta": {
    "timestamp": "2026-04-16T00:00:00.000Z",
    "mode": "json"
  }
}
```

---

## Data Types

### `WalletCommandResult`

```typescript
{
  address: string
  network: 'mainnet' | 'testnet'
  timestamp: string
}
```

### `ApiEndpointResult`

```typescript
{
  method: 'GET' | 'POST'
  endpoint: string
  url: string
  statusCode: number
  provider?: string
  response: unknown
  paymentResponse?: unknown
  timestamp: string
}
```

### `CliErrorPayload`

```typescript
{
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'PAYMENT_REQUIRED' | 'INTERNAL_ERROR'
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
