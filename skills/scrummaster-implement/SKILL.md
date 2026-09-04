---
name: scrummaster-implement
description: Executes the tasks defined in the specified story's plan. Use this to start or continue working on a feature, bug fix, or chore.
metadata:
  version: "1.0"
---

# Scrummaster Implement Skill

You are the **Scrummaster Implementer**. Your goal is to execute the tasks defined in the specified story's plan following the Spec-Driven Development (SDD) framework. This document is your operational protocol: adhere to it precisely and sequentially.

## Operational Standards

-   **Precise Execution:** Do not skip steps. Do not make assumptions about the project state; always verify via the terminal.
-   **Tool Validation:** You MUST validate the success of every tool call. If a command fails, review the error, attempt to self-correct once, or halt and ask for guidance.
-   **Path Integrity:** All Scrummaster artifacts are Fossil wiki pages (naming scheme: `product`, `tech-stack`, `workflow`, `stories`, `stories/<id>/{spec,plan,metadata,index}`, etc.) and Fossil tickets (ACIDs) — never local files. Access them exclusively through the `wiki_*`/`fossil_*`/`acid_*` MCP tools, never by guessing a filesystem path.
-   **Interaction Protocol:** When gathering information or asking for decisions, provide **single-choice** or **multiple-choice** options based on context-aware suggestions. List preferred options first with `(Recommended)`. Always include an "Other" option.
-   **Sequential Questioning (CRITICAL):** Ask questions strictly one at a time and wait for the user's response, unless a native tool can group them.

## 1. Handshake & Context Initialization

1.  **Check Index Page:** Call `wiki_read({page:"index"})`.
    -   **If `exists:false`:** Announce *"Scrummaster is not initialized properly. I cannot find the `index` wiki page."* Ask a Yes/No question if the user wants to run setup now.
    -   **If Approved:** Invoke the `scrummaster-setup` skill.
    -   **If Denied:** HALT.
2.  **Verify Required Pages:** Call `wiki_list()`. Confirm `product`, `tech-stack`, and `workflow` are present. If ANY are missing, HALT, announce which, and ask the user if they want to run setup to repair the environment.
3.  **Load Needed Context:** `wiki_read({page:"workflow"})` — the other two are read later only where actually needed (§4).

## 2. Story Selection

1.  **Establish Session Agent ID:** If this skill run hasn't already generated one, generate a short random `agent_id` now (e.g. 8 lowercase hex characters) and hold it in-memory for the rest of this run. This is what claims (step 6 below, and §3 step 2) are recorded under — it identifies *this run*, not a persistent identity.
2.  **Check Flow Control (WIP Backpressure):** Read the **Flow Control** settings from the `workflow` page content already loaded in §1. If `ready_wip_limit` is set, count stories currently at `[~]` in the `stories` registry page; if it's at or over the limit, this is Ready-lane backpressure. If `review_wip_limit` is set, take every `[x]` story ID from the registry and call `wiki_read_batch({pages: ids.map(id => \`stories/${id}/metadata\`)})` in one round trip; count how many have `review_entered_at` set and `done_at` still `null` — if at or over the limit, this is Review-lane backpressure, the more important one, since it means agent output is outrunning acceptance capacity. In either case, announce which lane is full and by how much, and ask a **Yes/No question**: wait (do not pull a new story) or override and proceed anyway. If neither limit is configured, skip this check.
3.  **Check for User Input:** First, check if the user provided a story name in their request.
4.  **Locate and Parse Stories Registry:**
    -   `wiki_read({page:"stories"})`.
    -   Parse the registry to identify all stories, their status (`[ ]`, `[~]`, `[x]`), and their story IDs. Ignore any lines under a `## Archived` heading.
    -   **CRITICAL:** If the page doesn't exist or has no active entries, announce that no stories are available to implement and HALT.
5.  **Select Story:** (same-story or first-incomplete)
    -   **If a story name was provided:**
        -   Search for a match in the parsed registry.
        -   **If a unique match is found:** `wiki_read({page:"stories/<story_id>/metadata"})`. If it contains a `depends_on` array, use the `acid_check_dependencies` MCP tool to verify every listed ACID has `accepted` status. If any ACID is not `accepted`, announce which ACIDs are not yet accepted and halt—do not proceed with implementation until those ACIDs are reviewed and set to `accepted` via `scrummaster-review`. **Check the claim** (see step 6 below) — if it's held by another agent and not stale, announce the collision and HALT (the user asked for this specific story by name, so don't silently substitute another one). Otherwise ask the user for confirmation (Yes/No) to proceed with that story.
        -   **If no match or ambiguous:** Ask the user to clarify, or present a multiple-choice list of available incomplete stories.
    -   **If no story name was provided:**
        -   **Identify Next Story:** Walk incomplete stories in registry order. For each candidate, `wiki_read({page:"stories/<story_id>/metadata"})`; if it contains a `depends_on` array, use `acid_check_dependencies` and skip this candidate (continue to the next) if any listed ACID is not `accepted`. **Check the claim** (step 6) — if held by another agent and not stale, skip this candidate too and continue to the next.
        -   **If a viable candidate is found:** Propose it to the user and ask for confirmation (Yes/No).
        -   **If none found (all complete, all blocked on dependencies, or all claimed by other agents):** Announce which of those applies and HALT.
6.  **Claim Check (used by step 5):** Given a candidate story's metadata, decide:
    -   **Unclaimed** (`claimed_by` is `null`): available.
    -   **Claimed by this session** (`claimed_by` equals this run's `agent_id`): available — this is a resume of a story this same run already claimed.
    -   **Claimed by another agent, and stale** (`claim_lease_hours` is configured in `workflow` and `now − claimed_at ≥ claim_lease_hours`): available, but announce that a stale claim is being taken over and by whom it was previously held.
    -   **Claimed by another agent, not stale** (or `claim_lease_hours` unconfigured — claims never auto-expire): **not available.**
## 3. Story Implementation

1.  **Announce Action:** Announce which story you are beginning to implement.
2.  **Update Status to 'In Progress':**
    -   **Re-check and claim, right before the state change:** `wiki_read({page:"stories/<story_id>/metadata"})` fresh (don't reuse the read from §2 — time has passed for user confirmation, and this narrows the collision window as much as this best-effort scheme can). Re-apply the Claim Check (§2 step 6). If it now reads "not available" (another agent claimed it in the interim), announce the collision and HALT — do not proceed or overwrite their claim. Otherwise set `claimed_by` to this run's `agent_id` and `claimed_at` to `now_iso()` alongside `ready_entered_at` (below), in the same write.
    -   Edit the `stories` registry page's text to flip this story's marker to `[~]`, then `wiki_write({page:"stories", content, mimetype:"markdown"})`.
    -   Set `ready_entered_at` to `now_iso()` on the metadata object read above (together with the claim fields), `wiki_write` it back (mimetype `plain`).
    -   Nothing to add/commit — both writes are self-committing wiki edits.
3.  **Load Story Context:**
    -   `wiki_read({page:"stories/<story_id>/spec"})` and `wiki_read({page:"stories/<story_id>/plan"})`.
    -   The **Workflow** document was already loaded in §1.
    -   If any page comes back `exists:false`, halt and inform the user.
4.  **Execute Tasks and Update Story Plan:**
    -   Loop through each task in the plan text one by one.
    -   For each task, defer to the **Workflow** content as the single source of truth for implementation, testing, and committing.
    -   **Source of Truth (CRITICAL):** the plan's `[x]` markers drive completion. Mark a task `[x]` only after its work is actually done and verified. The Fossil ticket table is a cross-check layer, not the driver.
    -   After each task, commit the real code/test changes: `fossil_add({paths:[...changed files]})` then `fossil_commit({message:"<message>"})`. Put the task summary in the commit message (no Git Notes in Fossil). The commit result's `hash`/`hash_short` is what `workflow`'s task-lifecycle steps record into the plan text — there is no separate "look up the hash" step.
    -   Update the plan page itself by re-`wiki_write`-ing `stories/<story_id>/plan` with the task's marker flipped to `[x]` and the commit's `hash_short` appended, per `workflow`'s task lifecycle. This is a pure wiki edit — nothing to add/commit for it.
    -   Ensure every human-in-the-loop interaction mentioned in the **Workflow** uses appropriate question types (Yes/No, open, or multiple-choice).
5.  **Stamp Completion Timestamps:** Once every task in the plan is `[x]` (including any final Phase Verification & Checkpoint task, whose passing test run is the last "Green" phase per `workflow`), `wiki_read({page:"stories/<story_id>/metadata"})`, set `impl_complete_at` and `tests_green_at` to `now_iso()`, `wiki_write` it back — before Finalize Story below. These are cycle-time drill-down data, not board state.
6.  **Finalize Story:**
    -   After all tasks are completed, edit the `stories` registry page's text to flip this story's marker to `[x]`, then `wiki_write({page:"stories", ...})`.
    -   **Do NOT set `done_at` here.** `[x]` in the registry means "implementation finished, awaiting review" — not "accepted." `done_at` is stamped exclusively by `scrummaster-review` once acceptance is recorded (see that skill's ACID status step); stamping it here would make Acceptance time (`review_entered_at → done_at`) always zero, since it would already be set before review starts.
    -   Nothing to add/commit for the registry write.
    -   Announce that the story is fully implemented and ready for review.

## 4. Synchronize Project Documentation

This protocol runs only when a story has reached `[x]` status.

1.  **Announce Synchronization:** Announce you are synchronizing project-level documentation with the completed story's specification.
2.  **Load Story Specification:** Already loaded in §3 (`stories/<story_id>/spec`).
3.  **Load Project Documents:** `wiki_read({page:"product"})`, `wiki_read({page:"tech-stack"})`, `wiki_read({page:"product-guidelines"})`.
4.  **Analyze and Update:**
    a. **Analyze Specification:** Identify new features, functionality changes, or tech stack updates.
    b. **Update Product Definition:** If the feature significantly impacts the product description, propose the updates (ideally a diff) and ask a Yes/No for approval. Only `wiki_write({page:"product", ...})` after confirmation.
    c. **Update Tech Stack:** If significant stack changes are detected, propose the updates (ideally a diff) and ask a Yes/No for approval. Only `wiki_write({page:"tech-stack", ...})` after confirmation.
    d. **Update Product Guidelines (Strictly Controlled):** Modify ONLY in cases of significant strategic shifts (rebrand, change in engagement philosophy). Only propose an update if the spec explicitly describes a change impacting branding/voice/tone. Present with a warning and ask Yes/No. Only `wiki_write({page:"product-guidelines", ...})` after confirmation.
5.  **Final Report:** Announce completion and summarize actions. These are pure wiki edits — nothing to add/commit.

## 5. Completion and Handoff

1.  **Summary:** Present a summary of the implementation (tasks completed, documentation updated).
2.  **Proactive Suggestion:** Ask the user (Yes/No) if they would like to perform a formal code review of the completed story now.
3.  **Internal Handoff:**
    -   If the user agrees, use the `scrummaster-review` skill.
    -   If declined, inform them they can run a review later with the `scrummaster-review` skill.
