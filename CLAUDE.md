# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Scrummaster is a **Claude Code / opencode plugin**: a set of agent Skills that implement Spec-Driven Development entirely on top of **Fossil** (no Git), plus a TypeScript MCP server that is the *exclusive* channel through which those skills touch Fossil. There is no local-filesystem project state and no application build/run — the "product" is the skill protocol text plus the MCP server binary. All scrummaster artifacts (product docs, tech stack, workflow, code style guides, epic/story registries, per-story spec/plan/metadata) live as **Fossil wiki pages**; Fossil's `ticket` table is the separate, unchanged store for ACID (Acceptance Criteria) rows.

Three parts, and how they relate:

- **`skills/<name>/SKILL.md`** — the actual operational protocol for each command (`scrummaster-setup`, `scrummaster-newepic`, `scrummaster-newstory`, `scrummaster-implement`, `scrummaster-status`, `scrummaster-revert`, `scrummaster-review`). These are read and followed step-by-step by an agent; they are the source of truth for behavior. Assets (code style guides, `ticket_schema.sql`, `workflow.md` template) live under `skills/scrummaster-setup/assets/` — these are *plugin* files read via the ordinary filesystem `Read` tool and pushed into a project's wiki; they are never themselves stored in wiki.
- **`commands/scrummaster/*.md`** — thin opencode slash-command wrappers (`/scrummaster:scrummaster-*`) that just tell the agent to load and follow the corresponding skill.
- **`mcp/`** — a standalone Node/TypeScript MCP stdio server (`scrummaster-fossil`) that shells out to the `fossil` CLI. It is the only way any skill touches Fossil — no `SKILL.md` should instruct raw `fossil <cmd>` shell execution; every Fossil interaction (wiki, tickets, commits, diffs, checkout state) goes through one of this server's tools. Registered in `opencode.json`.

When editing behavior, change the `SKILL.md` prose (and keep `commands/scrummaster/*.md` in sync if a command's argument handling changes) — don't look for application code implementing these steps, there isn't any.

## MCP server (`mcp/`) — the only buildable/testable code

```bash
cd mcp
npm install
npm run build   # tsc -> dist/
npm test         # tsc && node --test dist/*.test.js
npm start        # node dist/server.js (stdio MCP server)
```

Source layout:
- `mcp/src/server.ts` — registers every MCP tool. Three prefixes: `fossil_*` (generic VCS ops — `fossil_info`, `fossil_init`, `fossil_open`, `fossil_changes`, `fossil_diff`, `fossil_ls`, `fossil_add`, `fossil_addremove`, `fossil_commit`, `fossil_revert`, `fossil_update`, `fossil_timeline`, `fossil_branch_list`, `fossil_apply_ticket_schema`, `fossil_set_setting`), `wiki_*` (`wiki_write`, `wiki_read`, `wiki_read_batch`, `wiki_list` — the primary store for all scrummaster docs), and `acid_*` (ticket operations — `acid_tickets`, `acid_ticket_rollup`, `acid_push`, `acid_set_status`, `acid_check_dependencies`, `acid_parse_spec_text`, `acid_wiki_spec_acids`). Each tool wraps a `fossil.ts` function and returns JSON as `{content: [{type: "text", text}]}` (JSON field names are `snake_case`, matching the `snake_case` tool-argument convention), with `isError: true` on failure.
- `mcp/src/fossil.ts` — the Fossil client. Everything shells out to the `fossil` CLI via a `Runner` (`defaultRunner` uses `child_process.spawn`; `mcp/src/fossil.test.ts` injects a mock `Runner` seeded with real captured `fossil` output — no live binary needed to run `npm test`). `cwd` is `process.env.FOSSIL_CWD ?? process.cwd()`; `opencode.json` sets `FOSSIL_CWD` explicitly rather than relying on the spawned process's own cwd.
- `mcp/src/spec.ts` — `parseSpecAcids`, pure text→structured-data parsing of ACID bullets (format `` - `story_id.COMPONENT.n` — requirement text ``, optional trailing `[deprecated]`/`[deprecated: reason]`). No filesystem/path logic lives here — callers pass either raw drafted text (`acid_parse_spec_text`, used before a spec is written to wiki) or a `story_id` that `acid_wiki_spec_acids` resolves to a wiki page itself.

**Fossil CLI facts that aren't what a Git-trained reader would guess** — verified against a real `fossil` 2.23 binary during implementation, not assumed from docs:
- `fossil diff` has no `--shortstat`/`--name-only`. The real flags are `--numstat` (per-file + `TOTAL` added/removed line counts) and `--brief` (still change-type-code-prefixed lines, not bare filenames — `getDiff` strips the prefix). `--from`/`--to` do work as named.
- `fossil wiki create <page>` fails if the page already exists; `fossil wiki commit <page>` fails if it doesn't. There is no single create-or-update subcommand despite how the CLI docs read. `writeWikiPage` tries `create` first and falls back to `commit` on the "already exists" error.
- `fossil wiki export` of a missing page exits 1 with `wiki page [name] not found` on stderr — `readWikiPage` treats that specific message as `{exists:false}`, anything else as a real thrown error.
- `fossil commit` succeeds with `New_Version: <64-char SHA3-256 hash>` on its own stdout line; "nothing has changed; use --allow-empty to override" (exit 1) is a normal, expected outcome several skill steps branch on — `commit()` returns `{committed:false, reason}` for it rather than throwing.
- Writing a wiki page produces **no** pending `fossil changes`/`fossil status` output and **no** new entry in `fossil timeline -t ci` — wiki pages are Fossil "control artifacts" written straight to the repository database, exactly like tickets (`fossil ticket add/change`, unchanged from before this migration). This is why most `fossil add`/`fossil commit` "finalize" steps that touch only scrummaster docs/registries/metadata don't exist anymore (see below) — there's nothing in the working tree to add.

## Core domain model: ACID tickets

An **ACID** (Acceptance Criteria ID) is a stable identifier `story_id.COMPONENT.n` (e.g. `login-flow.AUTH.1`) assigned to each acceptance criterion in a story's `spec` wiki page. Each ACID maps 1:1 to a row in the Fossil repository's own `ticket` table, extended with custom columns (`epic_id`, `story_id`, `acid`, `component`, `deprecated`, `acai_status`, `acai_comment`, `last_seen_commit` — see `skills/scrummaster-setup/assets/ticket_schema.sql`, applied via the `fossil_apply_ticket_schema` MCP tool).

Two separate status fields matter and must not be conflated:
- `status` — Fossil's built-in Open/Closed field.
- `acai_status` — the richer workflow vocabulary (`assigned | blocked | incomplete | completed | rejected | accepted`), set via `acid_set_status`.

**The critical invariant**: a story's `plan` wiki page's `[x]` task markers are the **source of truth** for whether work is done. The Fossil ticket table (and `acai_status` in particular) is a traceability/audit layer that `scrummaster-review` cross-checks against the plan — it never drives completion. When touching review or implement logic, preserve this direction; don't make ticket status authoritative.

## Wiki page naming scheme

1:1 mapping, lowercase/hyphenated, `/`-hierarchical page names (verified working end-to-end against a real Fossil binary):

`product`, `product-guidelines`, `tech-stack`, `workflow`, `index`, `code_styleguides/<lang>`, `epics`, `epics/<id>/metadata`, `epics/<id>/index`, `stories`, `stories/<id>/spec`, `stories/<id>/plan`, `stories/<id>/metadata`, `stories/<id>/index`.

Doc/spec/plan pages are written `mimetype:"markdown"` (Fossil's default is its own wiki markup, which misrenders GFM); metadata pages (JSON text) use `mimetype:"plain"`.

**No hard delete.** Fossil's wiki CLI has no delete subcommand, and Fossil never discards history by design. "Archiving" a story (`scrummaster-review` §3.3) means: flip `status:"archived"` on its metadata page, and move its registry line into a `## Archived` section at the bottom of the `stories`/`epics` page — never delete anything. Registry-parsing logic everywhere should stop at (or ignore) `## Archived`.

## Story lifecycle (what the skills implement)

1. **`scrummaster-setup`** — detects/initializes the Fossil checkout (`fossil_info`/`fossil_init`/`fossil_open`), disables autosync once (`fossil_set_setting({name:"autosync",value:"off"})` — avoids a commit hanging on missing sync credentials), applies the ticket schema, and writes the `product`/`product-guidelines`/`tech-stack`/`workflow`/`code_styleguides/*` wiki pages (workflow and style guides are read from the plugin's own `assets/` first, then pushed via `wiki_write`). Writes the `index` page last — every other skill's first move is `wiki_read({page:"index"})` to confirm the project is initialized. Resumption state (which of the above already exist) is computed from `wiki_list()` results against a literal chain written directly into the skill's prose — there is no `resume.py` script anymore (retired along with all local-file state).
2. **`scrummaster-newepic`** — groups stories under the `epics` registry page and `epics/<id>/{metadata,index}`.
3. **`scrummaster-newstory`** — interactively drafts a spec (ACID-tagged acceptance criteria) and plan (phased task list following `workflow`) in-conversation, extracts ACIDs from the drafted text via `acid_parse_spec_text` (no round trip needed — nothing's written yet), then writes `stories/<story_id>/{spec,plan,metadata,index}` (`story_id` = `shortname_YYYYMMDD`) and pushes one Fossil ticket per ACID via `acid_push`. Story metadata can declare `depends_on`/`assumes_interface` ACIDs from other stories; self-dependency and simple two-story cycles are rejected at creation time.
4. **`scrummaster-implement`** — before pulling a story, checks configured `ready_wip_limit`/`review_wip_limit` (from `workflow`'s Flow Control section) and backpressures if a lane is full. Picks a story (respecting `depends_on` gating via `acid_check_dependencies` — dependencies must be `accepted` first), executes plan tasks in order per `workflow`, committing real code changes after each task (`fossil_add`/`fossil_commit` — its result's `hash`/`hash_short` is written straight into the plan page, no separate hash lookup), and flips `[x]` markers via `wiki_write` as the actual driver of progress. On story completion it optionally syncs the `product`/`tech-stack`/`product-guidelines` pages.
5. **`scrummaster-review`** — diffs the story's changes (`fossil_diff`/`fossil_changes` — real source-code diffing, unaffected by the wiki migration) against the spec/plan/code-style-guide pages, cross-checks each ACID's plan `[x]` state against its Fossil ticket `acai_status` (reporting drift either direction), runs the test suite, and on completion calls `acid_set_status` to record `accepted`/`rejected`/etc. per ACID. Stamps `review_entered_at` at scope confirmation (start of review) and `done_at` only after acceptance is fully recorded (end of review) — these two timestamps are what `scrummaster-status` reports as Build time / Acceptance time; getting the stamping order right matters (`scrummaster-implement` deliberately does *not* stamp `done_at` — see its own file for why).
6. **`scrummaster-status`** — reports task progress, ACID ticket drift, per-lane WIP (Ready/Review) against configured limits, Review-queue age with SLA flagging, and the Build-time/Acceptance-time split, all computed from the `stories` registry page plus `wiki_read_batch` over every story's metadata page.
7. **`scrummaster-revert`** — `fossil_revert`/`fossil_update` for real checkout state (unaffected by the wiki migration), plus resetting the relevant plan/registry page's markers via `wiki_write`.

Most "finalize: add and commit" steps that touched only scrummaster docs/registries/metadata no longer exist — wiki writes are already durable (see the Fossil CLI facts above). `fossil_add`/`fossil_commit` only appear where a skill is committing real source/test code changes (`scrummaster-implement`'s per-task commits, `scrummaster-review`'s fix commits).

## Conventions when editing `SKILL.md` files

- Every skill's "Operational Standards" section repeats the same rules (precise execution, validate every tool call, `wiki_*`/`fossil_*`/`acid_*` MCP tools only — never a raw shell `fossil` command or a guessed filesystem path, sequential single-choice/Yes-No/multiple-choice questioning with a preferred option marked `(Recommended)` and an "Other" fallback). Keep new/edited protocol steps consistent with that interaction style rather than introducing open-ended free-text prompts.
- The "Handshake & Context Initialization" pattern (check `wiki_read({page:"index"})`, `wiki_list()` for the specific pages that skill needs, `wiki_read` only what's actually consumed later) is near-identical across all 6 non-setup skills — apply changes to it uniformly rather than letting the skills drift apart.
- Skills cross-invoke each other by name (e.g. `scrummaster-implement` hands off to `scrummaster-review`) rather than duplicating logic — prefer an internal handoff over inlining another skill's steps.
- Numbered section structure (`## 1. Handshake & Context Initialization`, etc.) is meaningful only internally; skills are told not to expose section numbers to the user, only human-readable artifact names.
