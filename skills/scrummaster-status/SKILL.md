---
name: scrummaster-status
description: Displays the current progress of the project by parsing the Stories Registry and individual story plans.
metadata:
  version: "1.0"
---

# Scrummaster Status Skill

You are an AI agent. Your primary function is to provide a status overview of the project by parsing the Stories Registry and individual story plans.

## Operational Standards

-   **Precise Execution:** Do not skip steps. Do not make assumptions about the project state; always verify via the terminal.
-   **Tool Validation:** You MUST validate the success of every tool call. If a command fails, review the error, attempt to self-correct once, or halt and ask for guidance.
-   **Path Integrity:** Always use relative paths starting from the project root (e.g., `scrummaster/stories.md`).
-   **Sequential Questioning (CRITICAL):** Ask questions strictly one at a time and wait for the user's response, unless a native tool can group them.

## 1. Handshake & Context Initialization

1.  **Locate Index:** Check for the existence of `scrummaster/index.md` in the project root.
    -   **If Missing:** Announce *"Scrummaster is not initialized properly. I cannot find the `scrummaster/index.md` file."* Ask a Yes/No question if the user wants to run setup now.
    -   **If Approved:** Invoke the `scrummaster-setup` skill.
    -   **If Denied:** HALT.
2.  **Load & Verify Context:** Read `scrummaster/index.md` and use the links to locate: **Stories Registry** (`stories.md`), **Product Definition** (`product.md`), **Tech Stack** (`tech-stack.md`), **Workflow** (`workflow.md`). Verify every linked file exists. If ANY are missing, HALT, announce which is missing, and ask the user if they want to run setup to repair the environment.

## 2. Status Overview Protocol

### 2.1 Read Project Plan

1.  **Locate and Read:** Read the **Stories Registry** (check `scrummaster/index.md` for the link, else default `scrummaster/stories.md`).
2.  **Locate and Read Stories:**
    -   Parse the registry to identify all registered stories and their paths.
    -   **Parsing Logic:** Look for lines matching either the standard format `- [ ] **Story:` or the legacy format `## [ ] Story:`.
    -   For each story, resolve and read its **Implementation Plan** (check the story's `index.md`, else default `scrummaster/stories/<story_id>/plan.md`).

### 2.2 Parse and Summarize Plan

1.  **Parse Content:**
    -   Identify major phases/sections (top-level markdown headings).
    -   Identify tasks and status via checkbox markers: `[x]` completed, `[~]` in-progress, `[ ]` pending.
2.  **Generate Summary:** Create a concise summary of overall progress: total phases, total tasks, and counts of completed/in-progress/pending.

### 2.3 Present Status Overview

Present the summary in a clear, readable format, including:
-   **Current Date/Time:** the current timestamp.
-   **Project Status:** a high-level summary (e.g., "On Track", "Behind Schedule", "Blocked").
-   **Current Phase and Task:** the phase/task marked in progress.
-   **Next Action Needed:** the next pending task.
-   **Blockers:** any items explicitly marked as blockers in the plan.
-   **Phases (total), Tasks (total), Progress:** presented as `tasks_completed/tasks_total (percentage%)`.
