# Architecture

lumen-watch v0.1.0 design decisions and module breakdown.

## Overview

```
CLI (commander)
  └─ loadConfig (zod)
       └─ Watcher (one per account)
            ├─ Horizon.Server (stellar-sdk streaming)
            ├─ CursorStore (file-based, JSON)
            ├─ passesFilters (asset / amount / direction)
            └─ Notifiers (fan-out, error-isolated)
                 ├─ ConsoleNotifier
                 ├─ WebhookNotifier (fetch + retry)
                 └─ DiscordNotifier (embed + retry)
```

## Modules

### `src/config/schema.ts`
Zod schema for the JSON config file plus two helpers (`resolveHorizonUrl`, `resolveExplorerUrl`). All validation errors are collected into a single human-readable message. The Stellar public key regex (`/^G[A-Z2-7]{55}$/`) guards against accidentally pasting a secret key.

### `src/filters/filters.ts`
Three pure functions: `passesAssetFilter`, `passesMinAmountFilter`, `passesDirectionFilter`, composed by `passesFilters`. All are side-effect free, making them trivial to unit-test. Filters are applied in order: asset → amount → direction; the first failing filter short-circuits.

### `src/watcher/cursor-store.ts`
Reads/writes a flat JSON file mapping `address → pagingToken`. On a corrupted or missing file it starts fresh. Each `set()` call persists synchronously (acceptable for low-frequency writes; async persistence would add complexity without meaningful gain at this scale).

### `src/watcher/watcher.ts`
One `AccountWatcher` per configured account; all run concurrently. Each opens a Horizon `operations().forAccount().stream()` call. On `onerror` the stream is closed and a reconnect is scheduled with exponential backoff: 1 s → 2 s → 4 s … capped at 60 s. The backoff resets to 1 s on the first successful message.

The `Watcher` class (public API) manages a list of `AccountWatcher` instances. `stop()` drains all timers and closes all streams.

**Notifier isolation**: each notifier's `send()` is called in a `for` loop; errors are caught per-notifier so a failing notifier never blocks others.

### `src/notifiers/`
Every notifier implements `{ name: string; send(event: PaymentEvent): Promise<void> }`. The `WebhookNotifier` and `DiscordNotifier` both use the native `fetch` API (available in Node 18+) with an `AbortController` timeout and up to 3 retries with exponential backoff.

### `src/cli.ts`
`commander` parses four subcommands. `start` is the long-running process; it attaches `SIGINT`/`SIGTERM` handlers for clean shutdown. `once` is stateless: it uses the Horizon SDK directly and exits after printing.

## Key decisions

| Decision | Rationale |
|----------|-----------|
| ESM-only (`"type": "module"`) | Aligns with Node 20 best practices and avoids dual-package complexity |
| `tsup` for build | Zero-config bundler with native ESM + `.d.ts` output; single command |
| `pino` for logging | Structured, fast, JSON-serialisable; pino-pretty for dev terminals |
| Sync cursor write | Low frequency; async adds complexity without benefit at this scale |
| Native `fetch` for HTTP | No extra dependency; available in Node 18+ natively |
| `zod` for config | Runtime type safety + readable error messages; aligns with the ecosystem |
| No private key handling | lumen-watch is strictly read-only; this is a hard architectural constraint |

## Stream lifecycle

```
connect()
  │
  ├─ Horizon.stream({ onmessage, onerror })
  │     │
  │     ├─ onmessage → normalise → filter → fan-out to notifiers
  │     │   └─ cursorStore.set(pagingToken)
  │     │
  │     └─ onerror → closeStream() → scheduleReconnect(backoff)
  │
  └─ stop() → clearTimeout + closeStream()
```

## Adding a notifier

1. Create `src/notifiers/<name>.ts` implementing `Notifier`
2. Add a discriminated-union variant to `NotifierSchema` in `src/config/schema.ts`
3. Add a `case` in `src/notifiers/index.ts`
4. Write tests in `test/notifiers/`
5. Document in README under **Notifiers**
