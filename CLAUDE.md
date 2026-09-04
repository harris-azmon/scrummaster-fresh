# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Scrummaster is a **Claude Code / opencode plugin**: a set of agent Skills that implement Spec-Driven Development on top of a **Fossil-only** (no Git) workflow, plus a small TypeScript MCP server that gives those skills structured access to Fossil's ticket table. There is no application build/run — the "product" is the skill protocol text plus the MCP server binary.

Three parts, and how they relate:

- **`skills/<name>/SKILL.md`** — the actual operational protocol for each command (`scrummaster-setup`, `scrummaster-newepic`, `scrummaster-newstory`, `scrummaster-implement`, `scrummaster-status`, `scrummaster-revert`, `scrummaster-review`). These are read and followed step-by-step by an agent; they are the source of truth for behavior. Assets (code style guides, `ticket_schema.sql`, `workflow.md` template) live under `skills/scrummaster-setup/assets/`.
- **`commands/scrummaster/*.md`** — thin opencode slash-command wrappers (`/scrummaster:scrummaster-*`) that just tell the agent to load and follow the corresponding skill.
- **`mcp/`** — a standalone Node/TypeScript MCP server (`scrummaster-acid`) that shells out to the `fossil` CLI to read/write ACID tickets. Registered in `opencode.json`.

When editing behavior, change the `SKILL.md` prose (and keep `commands/scrummaster/*.md` in sync if a command's argument handling changes) — don't look for application code implementing these steps, there isn't any.

## MCP server (`mcp/`) — the only buildable/testable code

```bash
cd mcp
npm install
npm run build   # tsc -> dist/
npm start        # node dist/server.js (stdio MCP server)
```

There is no test suite or linter configured in `mcp/package.json` currently — verify changes by building (`npm run build`) and, if needed, exercising a tool call against a real Fossil checkout with the ticket schema applied (`skills/scrummaster-setup/assets/ticket_schema.sql`).

Source layout:
- `mcp/src/server.ts` — registers all MCP tools (`acid_tickets`, `acid_ticket_rollup`, `acid_spec_acids`, `acid_push`, `acid_set_status`, `acid_check_dependencies`, `acid_parse_spec_text`). Each tool wraps a `fossil.ts`/`spec.ts` function and returns JSON as `{content: [{type: "text", text}]}`, with `isError: true` on failure.
- `mcp/src/fossil.ts` — the Fossil client. All ticket reads/writes shell out to the `fossil` CLI via a `Runner` (`defaultRunner` uses `child_process.spawn`; tests can inject a mock runner). Reads use `fossil sql --readonly` with `.mode json`; writes use `fossil ticket add`/`fossil ticket change`. `cwd` is `process.env.FOSSIL_CWD ?? process.cwd()`.
- `mcp/src/spec.ts` — parses ACID bullets out of a story's `spec.md` (regex-based, format `` - `story_id.COMPONENT.n` — requirement text ``, with an optional trailing `[deprecated]`/`[deprecated: reason]`).

SQL string interpolation in `fossil.ts` uses manual `escapeSqlString` (doubling `'`) rather than parameterized queries, since `fossil sql` takes a raw script over stdin — keep that escaping when adding new query helpers.

## Core domain model: ACID tickets

An **ACID** (Acceptance Criteria ID) is a stable identifier `story_id.COMPONENT.n` (e.g. `login-flow.AUTH.1`) assigned to each acceptance criterion in a story's `spec.md`. Each ACID maps 1:1 to a row in the Fossil repository's own `ticket` table, extended with custom columns (`epic_id`, `story_id`, `acid`, `component`, `deprecated`, `acai_status`, `acai_comment`, `last_seen_commit` — see `skills/scrummaster-setup/assets/ticket_schema.sql`).

Two separate status fields matter and must not be conflated:
- `status` — Fossil's built-in Open/Closed field.
- `acai_status` — the richer workflow vocabulary (`assigned | blocked | incomplete | completed | rejected | accepted`), set via `acid_set_status`.

**The critical invariant**: `plan.md`'s `[x]` task markers are the **source of truth** for whether work is done. The Fossil ticket table (and `acai_status` in particular) is a traceability/audit layer that `scrummaster-review` cross-checks against the plan — it never drives completion. When touching review or implement logic, preserve this direction; don't make ticket status authoritative.

## Story lifecycle (what the skills implement)

1. **`scrummaster-setup`** — scaffolds `scrummaster/` (product.md, product-guidelines.md, tech-stack.md, workflow.md, code_styleguides/, index.md), initializes/opens the Fossil checkout, and applies the ticket schema. `scrummaster/index.md` is the handshake file every other skill reads first to locate everything else.
2. **`scrummaster-newepic`** — groups stories under `scrummaster/epics.md` / `scrummaster/epics/<id>/`.
3. **`scrummaster-newstory`** — interactively drafts `spec.md` (ACID-tagged acceptance criteria) and `plan.md` (phased task list following `workflow.md`), creates `scrummaster/stories/<story_id>/` (`story_id` = `shortname_YYYYMMDD`), and pushes one Fossil ticket per ACID via the `acid_push` MCP tool. Story `metadata.json` can declare `depends_on`/`assumes_interface` ACIDs from other stories; self-dependency and simple two-story cycles are rejected at creation time.
4. **`scrummaster-implement`** — picks a story (respecting `depends_on` gating via `acid_check_dependencies` — dependencies must be `accepted` first), executes `plan.md` tasks in order per `workflow.md`, committing after each task, and flips `[x]` markers as the actual driver of progress. On story completion it optionally syncs `product.md`/`tech-stack.md`/`product-guidelines.md`.
5. **`scrummaster-review`** — diffs the story's changes against `spec.md`/`plan.md`/code style guides, cross-checks each ACID's plan `[x]` state against its Fossil ticket `acai_status` (reporting drift either direction), runs the test suite, and on completion calls `acid_set_status` to record `accepted`/`rejected`/etc. per ACID — again, this records the audit trail, it does not retroactively decide completion.
6. **`scrummaster-status`** / **`scrummaster-revert`** — progress rollup and `fossil revert`/`fossil update`-based rollback, respectively.

All state changes (registry files, story artifacts, ticket updates) are committed with `fossil add` + `fossil commit`, never `git`.

## Conventions when editing `SKILL.md` files

- Every skill's "Operational Standards" section repeats the same rules (precise execution, validate every tool call, relative paths from project root, sequential single-choice/Yes-No/multiple-choice questioning with a preferred option marked `(Recommended)` and an "Other" fallback). Keep new/edited protocol steps consistent with that interaction style rather than introducing open-ended free-text prompts.
- Skills cross-invoke each other by name (e.g. `scrummaster-implement` hands off to `scrummaster-review`) rather than duplicating logic — prefer an internal handoff over inlining another skill's steps.
- Numbered section structure (`## 1. Handshake & Context Initialization`, etc.) is meaningful only internally; skills are told not to expose section numbers to the user, only human-readable artifact names.
