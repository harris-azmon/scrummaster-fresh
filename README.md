# Scrummaster

**Measure twice, code once.**

Scrummaster is a set of AI agent skills that enable **Spec-Driven Development** on a **Fossil-only** workflow. It turns your agent into a proactive project manager that follows a strict protocol to specify, plan, and implement software features and bug fixes.

Instead of just writing code, Scrummaster ensures a consistent lifecycle for every task: **Context -> Spec & Plan -> Implement**.

The philosophy is simple: control your code. By treating context as a managed artifact alongside your code, your repository becomes a single source of truth that drives every agent interaction.

**Fossil-first.** Scrummaster targets a [Fossil](https://fossil-scm.org/) workflow (Cathedral-style, trunk-oriented). There is no Git support, and no local filesystem storage either: every scrummaster artifact — product docs, tech stack, workflow, code style guides, epic/story registries, and each story's spec/plan/metadata — is a Fossil **wiki** page, and all Fossil access (wiki, tickets, commits, diffs, checkout state) goes exclusively through the bundled MCP server (stdio), never raw shell. Each ACID (Acceptance Criteria ID) in a story's `spec` wiki page maps 1:1 to a ticket in the repository's own Fossil `ticket` table — the simplification that replaces any external SaaS or Trello export. Each story's `plan` page's `[x]` markers remain the **source of truth** for completion; Fossil tickets are the traceability/audit layer that `scrummaster-review` cross-checks.

## Installation

Scrummaster is packaged as standard agent skills, modeled after the [conductor](https://github.com/gemini-cli-extensions/conductor) plugin. Point your agent's skill loader at the `skills/` directory in this repo, or copy `skills/` into your agent's skills location (e.g. `.opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`).

The Fossil MCP server (`mcp/`) must be built (`npm install && npm run build` in `mcp/`) and registered as an MCP server (see `opencode.json`).

## Commands

| Command | Purpose | Artifacts (Fossil wiki pages + tickets) |
|---------|---------|-----------|
| `scrummaster-setup` | Scaffold the project context | `product`, `product-guidelines`, `tech-stack`, `workflow`, `code_styleguides/*`, `index` |
| `scrummaster-newepic` | Create a new epic to group stories | `epics`, `epics/<id>/{metadata,index}` |
| `scrummaster-newstory` | Start a new story, generate spec + plan, create ACID tickets | `stories`, `stories/<id>/{spec,plan,metadata,index}` + Fossil tickets |
| `scrummaster-implement` | Execute the plan | `stories`, `stories/<id>/plan` |
| `scrummaster-status` | Show project progress | reads `stories` + per-story metadata (+ optional ticket rollup via MCP) |
| `scrummaster-revert` | Revert a story, phase, or task | `fossil_revert` / `fossil_update` |
| `scrummaster-review` | Review completed work, cross-check ACID tickets | reads plan + guidelines wiki pages + MCP ACID tools |

## Usage

Commands are namespaced, so invoke them as `/scrummaster:scrummaster-setup`:

1. **Setup (once):** `/scrummaster:scrummaster-setup`
2. **New epic:** `/scrummaster:scrummaster-newepic "Billing"`
3. **New story:** `/scrummaster:scrummaster-newstory "Add a dark mode toggle"`
4. **Implement:** `/scrummaster:scrummaster-implement`
5. **Monitor / revert / review:** `/scrummaster:scrummaster-status`, `/scrummaster:scrummaster-revert`, `/scrummaster:scrummaster-review`

## Installation (user-wide)

Symlink the repo into your global opencode config for live-sync (edits take effect on restart):

```bash
# Skills (auto-register as slash commands)
for s in scrummaster-implement scrummaster-newepic scrummaster-newstory scrummaster-revert scrummaster-review scrummaster-setup scrummaster-status; do
  ln -sfn "$(pwd)/skills/$s" ~/.config/opencode/skills/$s
done

# Namespaced commands (/scrummaster:...)
ln -sfn "$(pwd)/commands/scrummaster" ~/.config/opencode/commands/scrummaster

# Turbo Mode subagents (optional — see "Turbo Mode" below)
mkdir -p ~/.config/opencode/agents
for a in scrummaster-product-manager scrummaster-software-architect; do
  ln -sfn "$(pwd)/agents/$a.md" ~/.config/opencode/agents/$a.md
done

# Fossil MCP server: build it and register it in opencode config
(cd mcp && npm install && npm run build)
```

For a project-local (non-global) install, symlink or copy the same files
into `.opencode/skills/`, `.opencode/commands/scrummaster/`, and
`.opencode/agents/` under the target project instead.

## Turbo Mode

Opt-in, off by default. When enabled (a `Turbo Mode: Enabled` marker on the
`workflow` wiki page, set once during `/scrummaster:scrummaster-setup`),
every skill spawns a subagent instead of stopping to ask you a question,
and treats its answer exactly as it would yours:

- **`scrummaster-product-manager`** (`agents/scrummaster-product-manager.md`) —
  scope/priority/lifecycle decisions: epic assignment, story framing, spec/plan
  approval at the product level, archive/skip, revert target selection.
- **`scrummaster-software-architect`** (`agents/scrummaster-software-architect.md`) —
  technical decisions: spec/plan soundness, phase/code review verification
  (it actually runs your test suite, never guesses), tech-stack deviations,
  implementation ambiguity.

Both must be installed as real OpenCode subagents (see the symlink step
above) before enabling Turbo Mode — `/scrummaster:scrummaster-setup` will
still ask, but the answer only does anything once the agents exist under
`.opencode/agents/` or `~/.config/opencode/agents/`. Neither agent has
`edit` access; the architect may run test/lint/typecheck/build commands to
verify a claim, nothing else.

## Repository Structure

- `/skills`: the protocol logic (`SKILL.md`) for each command, plus assets.
- `/commands/scrummaster`: namespaced opencode command files (`/scrummaster:...`).
- `/agents`: Turbo Mode subagent definitions (OpenCode `mode: subagent` format) — see "Turbo Mode" above.
- `/mcp`: the TypeScript Fossil MCP server — generic VCS operations (status/diff/commit/revert/etc.), the wiki tools every skill uses as its primary store, and Fossil ticket/ACID operations (adapted from the acid-cli source). Used by every skill, not just `scrummaster-review`.
- `/plugin.json`: minimal plugin manifest.

## License

Apache License 2.0
