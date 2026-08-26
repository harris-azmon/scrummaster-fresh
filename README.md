# Scrummaster

**Measure twice, code once.**

Scrummaster is a set of AI agent skills that enable **Spec-Driven Development**. It turns your agent into a proactive project manager that follows a strict protocol to specify, plan, and implement software features and bug fixes.

Instead of just writing code, Scrummaster ensures a consistent lifecycle for every task: **Context -> Spec & Plan -> Implement**.

The philosophy is simple: control your code. By treating context as a managed artifact alongside your code, your repository becomes a single source of truth that drives every agent interaction.

## Installation

Scrummaster is packaged as standard agent skills, modeled after the [conductor](https://github.com/gemini-cli-extensions/conductor) plugin. Point your agent's skill loader at the `skills/` directory in this repo, or copy `skills/` into your agent's skills location (e.g. `.opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`).

## Commands

| Command | Purpose | Artifacts |
|---------|---------|-----------|
| `scrummaster-setup` | Scaffold the project context | `scrummaster/{product,product-guidelines,tech-stack,workflow}.md`, `scrummaster/code_styleguides/`, `scrummaster/index.md` |
| `scrummaster-newepic` | Create a new epic to group stories | `scrummaster/epics.md`, `scrummaster/epics/<id>/` |
| `scrummaster-newstory` | Start a new story, generate spec + plan | `scrummaster/stories.md`, `scrummaster/stories/<id>/{spec,plan,metadata,index}` |
| `scrummaster-implement` | Execute the plan | `scrummaster/stories.md`, `scrummaster/stories/<id>/plan.md` |
| `scrummaster-status` | Show project progress | reads `scrummaster/stories.md` |
| `scrummaster-revert` | Revert a story, phase, or task | reverts git history |
| `scrummaster-review` | Review completed work | reads plan + guidelines |

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
```

## Repository Structure

- `/skills`: the protocol logic (`SKILL.md`) for each command, plus assets and scripts.
- `/plugin.json`: minimal plugin manifest.

## License

Apache License 2.0
