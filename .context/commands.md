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

## Bitcoinagent API endpoint commands

These commands call the external Go `bitcoinagent` API. They all support:

| Flag | Required | Description |
|------|----------|-------------|
| `--api-url <url>` | No | API base URL. Defaults to `BITCOINAGENT_API_URL`, then `https://agentsats.stacksx402.com/` |
| `--json` | No | Emit structured JSON only |
| `--plain` | No | Emit minimal readable text |

JSON success payloads are wrapped in the CLI `CliResponse` shape. The command `data` is:

```json
{
  "method": "GET",
  "endpoint": "/api/v1/tiktok/user/info",
  "url": "https://agentsats.stacksx402.com/api/v1/tiktok/user/info?uniqueId=creator_1",
  "statusCode": 200,
  "provider": "fake",
  "response": {
    "statusCode": 0,
    "provider": "fake",
    "endpoint": "/api/user/info",
    "query": { "uniqueId": "creator_1" }
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

The `response` field contains the API endpoint's unwrapped `data` payload. `provider` is copied from the API envelope's `meta.provider` when present. `/health` has no provider because the API returns an unenveloped `{"status":"ok"}` object.

### Commands

| Command | API endpoint |
|---|---|
| `health` | `GET /health` |
| `services` | `GET /api/v1/services` |
| `service-endpoints --service <name>` | `GET /api/v1/services/:service/endpoints` |
| `tiktok-profile --username <username>` | `GET /api/v1/tiktok/user/info?uniqueId=...` |
| `tiktok-videos --sec-uid <secUid> [--count <number>] [--cursor <cursor>]` | `GET /api/v1/tiktok/user/posts?secUid=...&count=...&cursor=...` |
| `twitter-profile --username <username>` | `GET /api/v1/twitter/profile?username=...` |
| `twitter-highlights --user-id <id> [--count <number>]` | `GET /api/v1/twitter/highlights?user_id=...&count=...` |
| `twitter-tweets --user-id <id> [--count <number>]` | `GET /api/v1/twitter/tweets?user_id=...&count=...` |
| `twitter-followings --user-id <id> [--count <number>]` | `GET /api/v1/twitter/followings?user_id=...&count=...` |
| `<service> --endpoint <path> [--method <GET\|POST>] [--query <key=value>...] [--body-json <json>]` | Any endpoint under `airbnb`, `booking`, `google-flights`, `instagram`, `linkedin`, `tiktok`, `twitch`, `twitter`, or `zillow` |
| `api-call --method <GET\|POST> --path <path> [--query <key=value>...] [--body-json <json>]` | Any bitcoinagent API endpoint |

Service commands and `api-call` cover the expanded API surface. Use `services` and `service-endpoints --service <name>` to discover endpoint paths and query parameters. Pass a relative path such as `stays/search` to a service command, or pass the full path such as `/api/v1/airbnb/stays/search` to `api-call`.

Endpoint paths are validated before any HTTP request is made. Network-path references such as `//example.com/...`, backslashes, invalid percent encoding, and dot segments such as `.` or `..` are rejected with `VALIDATION_ERROR`.

Examples:

```bash
agentsats airbnb \
  --endpoint stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

agentsats google-flights \
  --endpoint booking/url \
  --method POST \
  --body-json '{"token":"booking-token"}' \
  --json

agentsats linkedin \
  --endpoint get-company-by-domain \
  --query domain=apple.com \
  --json

agentsats linkedin \
  --endpoint search-posts \
  --method POST \
  --body-json '{"search_keywords":"ai","page":1}' \
  --json

agentsats api-call \
  --method GET \
  --path /api/v1/airbnb/stays/search \
  --query placeId=ChIJVTPokywQkFQRmtVEaUZlJRA \
  --json

agentsats api-call \
  --method POST \
  --path /api/v1/google-flights/booking/url \
  --body-json '{"token":"booking-token"}' \
  --json
```

### Payment Required

When the API returns HTTP `402`, the CLI returns a structured `PAYMENT_REQUIRED` error. If the API supplies a base64 JSON `payment-required` header, it is decoded into `error.details.paymentRequired`.

Exit code: 1.

## `complete` — Shell completion generation

### Usage

```
agentsats complete <shell>
```

Supported shells: `zsh`, `bash`, `fish` (via `@bomb.sh/tab`).

This is registered automatically by `registerCompletionSupport(program)` in `src/completions/tab.ts`.

---

## Exit Code Summary

| Code | Meaning |
|------|---------|
| 0 | Success (including clean help exit) |
| 1 | Validation error, payment required, or internal error |
| 2 | Not found |

## Mode Priority

`--json` takes precedence over `--plain`. If neither is specified, mode is `human`.

```
resolveOutputMode({ json: true, plain: true })  → 'json'
resolveOutputMode({ plain: true })               → 'plain'
resolveOutputMode({})                             → 'human'
```
