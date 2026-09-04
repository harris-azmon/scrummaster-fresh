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
2.  **Generate Summary:** Create a concise summary of overall progress: total phases, total tasks, and counts of completed/in-progress/pending. The plan `[x]` markers are the **source of truth** for completion.

3.  **Cross-Check with ACID Tickets (optional):** Use the `acid_ticket_rollup` MCP tool to fetch the Fossil ticket completion summary. Compare it against the plan rollup and report any drift (e.g., plan task marked `[x]` but its ACID ticket still `Open`, or vice-versa). This is a cross-check, not the source of truth.

### 2.2.1 Compute Flow State

Classify each registered story by lane, using registry status plus its `metadata.json`:

-   **Ready:** registry status `[~]`.
-   **Awaiting Review:** registry status `[x]`, `metadata.json` `review_entered_at` is `null` (implementation finished, `scrummaster-review` hasn't been run yet).
-   **In Review:** registry status `[x]`, `review_entered_at` set, `done_at` still `null`. For each, compute **age** = now − `review_entered_at`.
-   **Done:** `done_at` set.

Read `workflow.md`'s **Flow Control** section for `ready_wip_limit`, `review_wip_limit`, `review_sla_hours` (any may be unset).

### 2.3 Present Status Overview

Present the summary in a clear, readable format, including:
-   **Current Date/Time:** the current timestamp.
-   **Project Status:** a high-level summary (e.g., "On Track", "Behind Schedule", "Blocked").
-   **Current Phase and Task:** the phase/task marked in progress.
-   **Next Action Needed:** the next pending task.
-   **Blockers:** any items explicitly marked as blockers in the plan.
-   **Phases (total), Tasks (total), Progress:** presented as `tasks_completed/tasks_total (percentage%)`.
-   **Flow WIP:** `Ready: <count>/<ready_wip_limit or "∞">`, `Review: <count>/<review_wip_limit or "∞">` (from §2.2.1). If a lane is at or over its configured limit, call this out explicitly — it means `scrummaster-implement` is (or should be) withholding new work.
-   **Review Queue:** list each story currently **In Review** with its age (now − `review_entered_at`). If `review_sla_hours` is configured, flag any story whose age exceeds it — this can fire even when Review is within its WIP cap, since a bursty reviewer can leave one card stale while nominally under the limit.
-   **Build time:** median, min, max of `ready_entered_at → review_entered_at` across stories that have entered Review (computed from `metadata.json`). This isolates agent-side latency (spec/plan drafting, implementation, dependency stalls) from review latency.
-   **Acceptance time:** median, min, max of `review_entered_at → done_at` across **Done** stories (computed from `metadata.json`). This isolates reviewer-side latency — per the two-phase split, this is where the bottleneck is expected to live once agent throughput exceeds review capacity.
-   **Ticket Drift (optional):** any mismatches between plan `[x]` and Fossil ticket status, if the cross-check was run.

If Build time looks anomalous for a specific story, drill in by reading that story's `metadata.json` directly for `spec_committed_at`, `plan_committed_at`, `impl_complete_at`, and `tests_green_at` — these sub-phase timestamps aren't part of the default overview (they're per-card diagnostic data, not board state), but they reconstruct where inside the build phase the story actually stalled.
