# Contributing to lumen-watch

Thank you for your interest in contributing! This document covers everything you need to go from zero to open PR.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Project structure](#project-structure)
- [Branch naming](#branch-naming)
- [Commit style](#commit-style)
- [How to pick and claim an issue](#how-to-pick-and-claim-an-issue)
- [Development workflow](#development-workflow)
- [PR checklist](#pr-checklist)
- [How reviews work](#how-reviews-work)
- [Stellar Wave issues](#stellar-wave-issues)

---

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **npm 10+** — check with `npm -v`
- A GitHub account and a fork of this repository

---

## Local setup

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/lumen-watch.git
cd lumen-watch

# 2. Install dependencies
npm install

# 3. Verify everything works
npm run typecheck
npm test
npm run build
```

If all three commands pass, you're ready.

---

## Project structure

```
src/
  cli.ts                # CLI entry point (commander)
  index.ts              # Public library exports
  config/schema.ts      # Zod schema + config loader
  watcher/watcher.ts    # Horizon stream, reconnect, cursor logic
  watcher/cursor-store.ts
  filters/filters.ts    # Asset / amount / direction filters
  notifiers/types.ts    # Notifier interface and PaymentEvent type
  notifiers/console.ts
  notifiers/webhook.ts
  notifiers/discord.ts
  notifiers/index.ts    # Notifier factory
  util/format.ts        # Formatting helpers
test/                   # Unit tests (vitest)
examples/               # Example config files
docs/                   # Design documents
```

Keep modules small and focused. New notifiers go in `src/notifiers/`. New CLI commands go in `src/cli.ts`.

---

## Branch naming

```
<type>/<short-description>
```

Examples:

| Type | When to use |
|------|-------------|
| `feat/` | New feature or notifier |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `test/` | Test additions or fixes |
| `chore/` | Tooling, deps, CI |
| `refactor/` | Code restructuring without behaviour change |

Example: `feat/telegram-notifier`, `fix/webhook-timeout`, `docs/improve-readme`

---

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`

Examples:

```
feat(notifiers): add Telegram notifier

fix(webhook): increase timeout to 10s for slow endpoints

docs: add Docker quickstart to README
```

Keep the subject line under 72 characters. Use the body to explain *why*, not *what*.

---

## How to pick and claim an issue

1. Browse [open issues](https://github.com/yourusername/lumen-watch/issues) — look for `good first issue` or `stellar-wave` labels.
2. Check the issue is not already assigned or has an open PR.
3. **Comment on the issue**: "I'd like to work on this" — a maintainer will assign it to you.
4. Fork the repo if you haven't already and create a branch.

Please don't submit a PR for an unclaimed issue — it avoids duplicate work.

---

## Development workflow

```bash
# Run tests in watch mode while developing
npm run test:watch

# Type-check without building
npm run typecheck

# Format your code
npm run format

# Lint
npm run lint

# Build to dist/
npm run build
```

For new notifiers, follow the pattern in `src/notifiers/webhook.ts`:

1. Create `src/notifiers/<name>.ts` implementing `Notifier`
2. Add a config schema in `src/config/schema.ts`
3. Wire it up in `src/notifiers/index.ts`
4. Write tests in `test/notifiers/`
5. Document it in `README.md` under **Notifiers**

---

## PR checklist

Before opening a PR, make sure all of these pass locally:

- [ ] `npm run typecheck` — no TypeScript errors
- [ ] `npm run lint` — no ESLint errors
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — builds without errors
- [ ] New code has tests (aim for all exported functions and classes)
- [ ] Docs updated (README, architecture.md if relevant)
- [ ] No `any` types introduced
- [ ] No private keys, secrets, or `.env` files committed

---

## How reviews work

- A maintainer will review within a few days.
- Expect at least one round of feedback — this is normal and constructive.
- Address review comments with new commits (don't force-push during review).
- Once approved, a maintainer will squash-merge your PR.

---

## Stellar Wave issues

Issues labelled `stellar-wave` are part of the Stellar Wave Program on [Drips](https://drips.network). Complexity tags map to Drips Wave points:

| Tag | Points |
|-----|--------|
| Trivial | 100 |
| Medium | 150 |
| High | 200 |

Rewards are distributed on merge. See [ISSUES_BACKLOG.md](./ISSUES_BACKLOG.md) for descriptions of all open Wave issues.
