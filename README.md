# Scrummaster

**Measure twice, code once.**

Scrummaster is a set of AI agent skills that enable **Spec-Driven Development** on a **Fossil-only** workflow. It turns your agent into a proactive project manager that follows a strict protocol to specify, plan, and implement software features and bug fixes.

Instead of just writing code, Scrummaster ensures a consistent lifecycle for every task: **Context -> Spec & Plan -> Implement**.

The philosophy is simple: control your code. By treating context as a managed artifact alongside your code, your repository becomes a single source of truth that drives every agent interaction.

**Fossil-first.** Scrummaster targets a [Fossil](https://fossil-scm.org/) workflow (Cathedral-style, trunk-oriented). There is no Git support. Each ACID (Acceptance Criteria ID) in a story's `spec.md` maps 1:1 to a ticket in the repository's own Fossil `ticket` table — the simplification that replaces any external SaaS or Trello export. `plan.md`'s `[x]` markers remain the **source of truth** for completion; Fossil tickets are the traceability/audit layer that `scrummaster-review` cross-checks via the bundled MCP server.

## Installation

Scrummaster is packaged as standard agent skills, modeled after the [conductor](https://github.com/gemini-cli-extensions/conductor) plugin. Point your agent's skill loader at the `skills/` directory in this repo, or copy `skills/` into your agent's skills location (e.g. `.opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`).

The ACID MCP server (`mcp/`) must be built (`npm install && npm run build` in `mcp/`) and registered as an MCP server (see `opencode.json`).

## Commands

| Command | Purpose | Artifacts |
|---------|---------|-----------|
| `scrummaster-setup` | Scaffold the project context | `scrummaster/{product,product-guidelines,tech-stack,workflow}.md`, `scrummaster/code_styleguides/`, `scrummaster/index.md` |
| `scrummaster-newepic` | Create a new epic to group stories | `scrummaster/epics.md`, `scrummaster/epics/<id>/` |
| `scrummaster-newstory` | Start a new story, generate spec + plan, create ACID tickets | `scrummaster/stories.md`, `scrummaster/stories/<id>/{spec,plan,metadata,index}` + Fossil tickets |
| `scrummaster-implement` | Execute the plan | `scrummaster/stories.md`, `scrummaster/stories/<id>/plan.md` |
| `scrummaster-status` | Show project progress | reads `scrummaster/stories.md` (+ optional ticket rollup via MCP) |
| `scrummaster-revert` | Revert a story, phase, or task | `fossil revert` / `fossil update` |
| `scrummaster-review` | Review completed work, cross-check ACID tickets | reads plan + guidelines + MCP ACID tools |

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

# ACID MCP server: build it and register it in opencode config
(cd mcp && npm install && npm run build)
```

## Repository Structure

- `/skills`: the protocol logic (`SKILL.md`) for each command, plus assets and scripts.
- `/commands/scrummaster`: namespaced opencode command files (`/scrummaster:...`).
- `/mcp`: the TypeScript ACID/Fossil-ticket MCP server (adapted from the acid-cli source), used by `scrummaster-review`.
- `/plugin.json`: minimal plugin manifest.

## License

Apache License 2.0
