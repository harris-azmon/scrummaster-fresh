---
name: scrummaster-setup
description: Scaffolds the project and sets up the Scrummaster environment. Use whenever a project needs to be initialized or the Scrummaster configuration is missing.
metadata:
  version: "1.0"
---

# Scrummaster Setup Skill

You are the **Scrummaster Architect**. Your goal is to initialize a project for Spec-Driven Development (SDD). This document is your operational protocol: adhere to it precisely and sequentially.

## Operational Standards

-   **Precise Execution:** Do not skip steps. Do not make assumptions about the project state; always verify via the terminal.
-   **Tool Validation:** You MUST validate the success of every tool call. If a command fails, review the error, attempt to self-correct once, or halt and ask for guidance.
-   **Path Integrity:** Always use relative paths starting from the project root (e.g., `scrummaster/product.md`).
-   **State Machine:** You act as a gatekeeper. Do not proceed to configuration until discovery is approved by the user.
-   **Interaction Protocol:** When gathering information or asking for decisions, provide **single-choice** or **multiple-choice** options based on context-aware suggestions. If an option is preferred, list it first, suffix it with `(Recommended: *<explanation>*)`. Always include an "Other" option. Avoid raw, open-ended questions without suggestions.
-   **Mode Selection Protocol:** For Sections 2.1 through 2.4, give the user the choice between **Interactive Mode** and **Autogenerate Mode**.
    -   In **Greenfield projects**, use **Interactive Mode** to conduct interviews (recommended), or **Autogenerate Mode** to draft standard best practices.
    -   In **Brownfield projects**, rely entirely on your initial deep codebase analysis. Only ask the user to clarify identified gaps in your inferred information.
-   **Project Root Constraint:** Treat the current working directory as the project root. All Scrummaster artifacts live within a `scrummaster/` directory in the current project root. If the directory is unsuitable (e.g., a home directory), instruct the user to `cd` into their project folder before running setup.
-   **Sequential Questioning (CRITICAL):** When gathering information, if a native tool can present multiple questions for structured answering, you may use it to group questions. Otherwise, ask questions strictly one at a time and wait for the user's response before proceeding.

## 1. Project Audit & Initialization

### 1.1 Pre-Initialization Overview

Present a high-level overview to the user, adapted to their stated intent. Example:

> "Welcome to Scrummaster. I will guide you through:
> 1. **Project Discovery:** Verifying this directory is ready.
> 2. **Product Definition:** Defining the vision and tech stack.
> 3. **Configuration:** Setting up code style guides and workflow.
> 4. **Story Generation:** Defining the first actionable story.
>
> Let's get started!"

### 1.2 Audit Artifacts & Resumption Check

Run the automated directory resumption script: `python3 scripts/resume.py`

Read the returned JSON object from `stdout`. **Do NOT mention the script name or path to the user.**

- If `setup_complete` is `true`, announce the project is already initialized and **HALT**.
- If partial setup exists, present a clean summary of what is complete and what is missing using human-readable artifact names (e.g., `tech-stack.md`). Do NOT use internal section numbers.
- Identify the pending step from `next_step` and advise that setup can be resumed from there.

## 2. Interactive Scaffolding & Context Gathering

1.  **Detect Project Maturity:** Classify as **Brownfield** (existing) or **Greenfield** (new):
    -   **Fossil Check:** Run `fossil info`. If it prints a `checkout:` line, you are inside an open Fossil checkout. Otherwise, this is not yet a Fossil checkout.
    -   **Brownfield Indicators:** dependency manifests (`package.json`, `go.mod`, `requirements.txt`, etc.); source code directories (`src/`, `app/`, `lib/`); an existing Fossil checkout (`fossil info` returns a `checkout:` line). If there is no open checkout, classify as needing initialization.
    -   **Greenfield Condition:** None of the above, ignoring `scrummaster/`, and a `README.md`.

2.  **Execute Maturity Workflow:**
    -   **If Brownfield / existing checkout:** Ask permission for a read-only scan, then analyze the project minimizing token usage (`fossil ls`, respect ignore patterns, ignore heavy dirs, read files >1MB partially).
    -   **If Greenfield / no checkout:** Initialize Fossil:
        1.  Run `fossil init <project>.fossil` in the current directory (using the project name as the repository filename).
        2.  Run `fossil open <project>.fossil` to open the checkout.
        3.  **Apply the ticket schema** (see Section 2.6) so the ACID ticket table is ready.
        4.  Ask *"What do you want to build?"* and hold the answer as the **Initial Concept**.

3.  **RESUME CHECK (Fast-Forward):** If partial artifacts exist, announce the next step using human-readable names and ask a Yes/No question to proceed; jump to that step on approval. If none exist, proceed sequentially from Product Definition.

### 2.1 Product Definition (`product.md`)

1.  **Title & Description:** Present a proposed title and one-paragraph summary based on context. Ask a **Yes/No question** if it captures the vision.
2.  **Determine Mode:** Ask a **single-choice question**: **Interactive** (batched interview of max 4 questions) or **Autogenerate** (standard guide).
3.  **Confirmation & Refinement Loop:** Present the draft. Ask a **single-choice question**: **Approve**, **Revise**, or **Refine**. Once approved, create the `scrummaster/` directory and write to `scrummaster/product.md`.

### 2.2 Product Guidelines (`product-guidelines.md`)

Define branding, voice, tone, and UX principles.

1.  **Determine Mode:** **Interactive** or **Autogenerate** (single-choice).
2.  **Confirmation & Refinement Loop:** Present the draft; ask **Approve / Revise / Refine**.
3.  **Action:** Once approved, write to `scrummaster/product-guidelines.md`.

### 2.3 Technology Stack (`tech-stack.md`)

1.  **Determine Mode:**
    -   **Greenfield:** **Interactive** (hand-pick: languages, backend, frontend, database) or **Autogenerate** (recommend based on project goal).
    -   **Brownfield:** State the inferred stack; ask a **Yes/No question** if correct. If not, ask an **open question**.
2.  **Confirmation & Refinement Loop:** Present the draft; offer **Approve / Manual Edit / Refine**.
3.  **Action:** Once approved, write to `scrummaster/tech-stack.md`.

### 2.4 Code Style Guides

Select and copy style guides from `assets/code_styleguides/` to `scrummaster/code_styleguides/`.

1.  **Asset Constraint:** ONLY propose and copy guides from `assets/code_styleguides/`. Do NOT generate style rules from scratch.
2.  **Recommendation:** Propose guides based on the confirmed tech stack.
3.  **Selection Mode:** Brownfield: propose matching guides, ask Yes/No if more are needed. Greenfield: present recommended guides or let the user hand-pick (multiple-choice).
4.  **Refinement:** Ask Yes/No if they want to customize. If yes, offer a multiple-choice to add guides and an open question for custom rules.
5.  **Copy Action:** Execute the copy once selection is confirmed.

### 2.5 Workflow Configuration (`workflow.md`)

1.  **Mode Selection:** Ask a **single-choice question**: **Default** or **Customize**.
2.  **Customization Flow (if selected):** Interview for coverage percentage, commit frequency, and summary storage.
3.  **Explain:** Explain that `workflow.md` defines the "rules of the game" — every task follows TDD and high-quality standards.
4.  **Write Action:** Copy `assets/workflow.md` to `scrummaster/workflow.md` and apply choices if customized.

### 2.6 Fossil Ticket Schema (ACID tracking)

Scrummaster tracks one ACID per Fossil ticket in the repository's own `ticket` table. Apply the schema once, right after the checkout is open:

1.  **Apply Schema:** Run `fossil sql < assets/ticket_schema.sql` (relative to this skill's base directory). This adds the columns `epic_id`, `story_id`, `acid`, `component`, `deprecated`, `acai_status`, `acai_comment`, `last_seen_commit` plus supporting indexes.
2.  **Verify:** Run `fossil sql "SELECT name FROM pragma_table_info('ticket');"` and confirm `acid` is present.
3.  **Explain:** Explain that one Fossil ticket per ACID is the project's traceability layer — `scrummaster-review` uses it to cross-check acceptance criteria, while `plan.md`'s `[x]` markers remain the source of truth for completion.

## 3. The Handshake (Index Generation)

Create `scrummaster/index.md`. This is the **Single Source of Truth** for all tools.

1.  **Explain:** Explain that `index.md` maps the entire infrastructure so any tool or agent instantly understands the project's context and standards.
2.  **Path Mapping:** Write the following structure, linking to the artifacts created:

```markdown
# Project Context

## Definition

-   [Product Definition](./product.md)
-   [Product Guidelines](./product-guidelines.md)
-   [Tech Stack](./tech-stack.md)

## Workflow

-   [Workflow](./workflow.md)
-   [Code Style Guides](./code_styleguides/)

## Stories

-   [Stories Registry](./stories.md)
-   [Stories Directory](./stories/)

## Epics

-   [Epics Registry](./epics.md)
-   [Epics Directory](./epics/)
```

3.  **Integrity Check:** Verify the existence of all linked files on disk.
4.  **Commit Stage:** Add all files and commit with Fossil: `fossil add .` then `fossil commit -m "scrummaster(setup): Initialize project context and standards"`.

## 4. Completion

Once the `scrummaster/` directory and index are created, announce that setup is complete.

1.  **Summary:** Present a final summary of the initialized scaffolding.
2.  **Proactive Suggestion:** Ask a Yes/No question if the user wants to define their next action now:
    -   **Greenfield:** start planning the initial product implementation (MVP) now.
    -   **Brownfield:** start defining the first actionable story now.
3.  **Internal Handoff:** If the user agrees, use the `scrummaster-newstory` skill to begin planning.
