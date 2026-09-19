# Scrummaster Plugin Rules

When the `scrummaster` plugin is active, follow these guidelines:

1. **Spec-Driven Development (SDD) via Fossil**:
   - All Scrummaster artifacts (product documentation, tech stack, workflow definitions, code style guides, epics, stories, specs, and plans) are stored exclusively in **Fossil wiki pages** and **Fossil tickets**.
   - Do NOT create local markdown files for specs, plans, or stories in the repository checkout tree unless specifically asked.
   - All Fossil interactions (reading/writing wiki pages, querying/updating tickets, checkouts, diffs, and commits) must go through the `scrummaster-fossil` MCP tools (`wiki_*`, `fossil_*`, `acid_*`). Never run raw shell `fossil` commands when MCP tools are available.

2. **Source of Truth**:
   - The story's `plan` wiki page's checkbox markers (`[x]`) are the single source of truth for task and phase completion.
   - Fossil tickets (ACIDs) serve as the traceability and verification audit layer.

3. **Skills**:
   - Use `scrummaster-setup` to initialize or audit project SDD scaffolding.
   - Use `scrummaster-newepic` to define top-level work areas.
   - Use `scrummaster-newstory` to draft specs with ACID bullets, generate task plans, and register tickets.
   - Use `scrummaster-implement` to pick up stories, check WIP limits, execute tasks sequentially, and commit changes per task.
   - Use `scrummaster-review` to inspect diffs against specs and style guides, verify ACIDs, and stamp acceptance.
   - Use `scrummaster-status` to report flow state, cycle time, WIP lanes, and plan progress.
   - Use `scrummaster-revert` to back out tasks, phases, or stories cleanly.
