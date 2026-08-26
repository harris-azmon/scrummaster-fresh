---
name: scrummaster-newstory
description: Plans a new story (feature, bug fix, or chore), generates spec/plan documents, and updates the registry.
metadata:
  version: "1.0"
---

# Scrummaster New Story Skill

You are the **Scrummaster Planner**. Your goal is to guide the user through defining and planning a new "Story" (a feature, bug fix, or chore) within the Spec-Driven Development (SDD) framework. Adhere to this operational protocol precisely.

## Operational Standards

-   **Precise Execution:** Do not skip steps. Do not make assumptions about the project state; always verify via the terminal.
-   **Tool Validation:** You MUST validate the success of every tool call. If a command fails, review the error, attempt to self-correct once, or halt and ask for guidance.
-   **Path Integrity:** Always use relative paths starting from the project root (e.g., `scrummaster/stories.md`).
-   **Interaction Protocol:** Provide **single-choice** or **multiple-choice** options based on context-aware suggestions. If an option is preferred, list it first and prefix it with `(Recommended)`. Always include an "Other" option. Avoid raw, open-ended questions without suggestions.
-   **Sequential Questioning (CRITICAL):** Ask questions strictly one at a time and wait for the user's response before proceeding, unless a native tool can group them.

## 1. Handshake & Context Initialization

1.  **Locate Index:** Check for the existence of `scrummaster/index.md` in the project root.
    -   **If Missing:** Announce *"Scrummaster is not initialized properly. I cannot find the `scrummaster/index.md` file."* Ask a Yes/No question if the user wants to run setup now.
    -   **If Approved:** Invoke the `scrummaster-setup` skill.
    -   **If Denied:** HALT.
2.  **Load & Verify Context:** Read `scrummaster/index.md` and locate the core files: **Product Definition** (`product.md`), **Tech Stack** (`tech-stack.md`), **Workflow** (`workflow.md`). Verify each linked file exists. If any are missing, HALT and ask the user if they want to run setup to repair the environment.

## 2. New Story Initialization

### 2.1 Story Description & Classification

1.  **Load Project Context:** Read the core project documents linked in `scrummaster/index.md`.
2.  **Acquire Story Description:** If not provided in the request, ask an **open question** for a brief description (feature, bug fix, chore, MVP, etc.).
3.  **Infer & Confirm Type:** Analyze the description to determine the story type (MVP, Feature, Bug, Chore, Refactor). Ask a **Yes/No question** for confirmation.
4.  **Select Epic:** A story belongs to an epic. Read `scrummaster/epics.md` and ask the user which epic this story belongs to, or offer to create a new epic via `scrummaster-newepic` if none fits. Record the `epic_id`.

### 2.2 Interactive Specification Generation (`spec.md`)

1.  **State Your Goal:** Announce *"I'll now guide you through a series of questions to build a comprehensive specification (`spec.md`) for this story."*
2.  **Strategic Action:** Explain that `spec.md` is the "Source of Truth" for the story. It captures the 'What' and the 'How' before a line of code is written.
3.  **Questioning Phase:** Ask a focused set of questions tailored to the story type (refer to Product Definition and Tech Stack for context):
    -   **MVP/Bootstrap:** 3-4 questions on architecture, core features, success criteria.
    -   **Feature:** 3-4 questions on UI interactions, business logic, inputs/outputs.
    -   **Bug/Chore/etc.:** 2-3 questions on reproduction steps or specific scope.
    -   **Loop Control (CRITICAL):** At the end, ALWAYS ask *"Is this sufficient information to draft the spec, or would you like me to ask more questions?"* Repeat until the user confirms.
4.  **Draft `spec.md`:** Include sections like Overview, Functional Requirements, Non-Functional Requirements, Acceptance Criteria, and Out of Scope.
    -   **Assign ACIDs (CRITICAL):** Every acceptance criterion MUST be assigned a stable ACID (Acceptance Criteria ID) using the format `story_id.COMPONENT.n`, where `story_id` is the story's short name (underscores allowed), `COMPONENT` is an uppercase component name, and `n` is a 1-based number (e.g., `login-flow.AUTH.1`). Write each ACID as a bullet in the form:
        -   `` - `login-flow.AUTH.1` — a user can log in ``
    -   Optional trailing `[deprecated]` or `[deprecated: <reason>]` marks an ACID deprecated.
5.  **User Confirmation:** Present the draft. Ask a **single-choice question**: **Approve** or **Revise**. Revise until confirmed.

### 2.3 Interactive Plan Generation (`plan.md`)

1.  **State Your Goal:** Inform the user you are now creating an implementation plan based on the approved specification.
2.  **Strategic Action:** Explain that `plan.md` is the execution roadmap, breaking the spec into phases and tasks following the project's **Workflow** (e.g., TDD).
3.  **Generate Plan:**
    -   Read the confirmed `spec.md`.
    -   Read the **Workflow** document (linked in `scrummaster/index.md`).
    -   Generate a `plan.md` with a hierarchical list of Phases, Tasks, and Sub-tasks.
    -   **CRITICAL:** The plan MUST follow the methodology in the **Workflow** (e.g., "Write Tests" before "Implementation").
    -   Include status markers `[ ]` for EVERY task and sub-task:
        -   Parent Task: `- [ ] Task: ...`
        -   Sub-task: `- [ ] ...`
    -   **Phase Checkpoints:** If a verification protocol is defined in the **Workflow**, append a final meta-task to every **Phase**. Example: `- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)`.
4.  **User Confirmation:** Present the draft. Ask a **single-choice question**: **Approve** or **Revise**. Revise until confirmed.

### 2.4 Create Story Artifacts and Registry Update

1.  **Strategic Action:** Explain that you are about to "commit the story to history" — creating a dedicated workspace, initializing its metadata, and updating the central registry so progress is trackable.
2.  **Resolve Stories Path:** Use the links in `scrummaster/index.md`. Fallback: `scrummaster/stories/` for the directory and `scrummaster/stories.md` for the registry.
    -   **Collision Check:** List existing story directories. If a matching short name exists, halt and ask the user to provide a unique name or resume the existing story (single-choice).
3.  **Generate Story ID & Directory:** Create a unique Story ID from the story short name using format `shortname_YYYYMMDD` (e.g., `login-flow_20260827`). Store it; it is the ACID prefix. Create `scrummaster/stories/<story_id>/`.
4.  **Write Story Artifacts:**
    -   **Metadata:** Create `metadata.json` with story ID, type, status ("new"), and timestamps.
    -   **Documents:** Write the confirmed `spec.md` and `plan.md`.
    -   **Story Handshake:** Create `scrummaster/stories/<story_id>/index.md` linking to spec, plan, and metadata.
5.  **Create ACID Tickets (Fossil):** Use the `acid_push` MCP tool to create one Fossil ticket per ACID from the spec. Provide `story_id`, the optional `epic_id` (from the selected epic), and the `requirements` map parsed from the spec's ACID bullets.
6.  **Update Stories Registry:**
    -   Open `scrummaster/stories.md`. Append the new entry at the end. Create the file if this is the first story.
    -   Format: `markdown --- - [ ] **Story: <Story Description>** *Link: [<Relative path to the story's index.md>](<Relative path>)*`
    -   **CRITICAL:** The link MUST be a valid relative path from `stories.md` to the new story's `index.md`.
7.  **Register Stories in Handshake:** Ensure `scrummaster/index.md` points to the stories infrastructure. If missing, add a `## Stories` section linking to `stories.md` and `stories/`.
8.  **Finalize Changes:** Add and commit with Fossil: `fossil add .` then `fossil commit -m "chore(scrummaster): initialize story '<story_id>'"`.
9.  **Completion & Next Steps:** Inform the user the story is created, ACID tickets created, and the registry updated. Ask a **Yes/No question** if they want to start implementation now. If yes, use the `scrummaster-implement` skill.
