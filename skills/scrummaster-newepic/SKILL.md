---
name: scrummaster-newepic
description: Creates a new epic to group related stories. Use when starting a new area of work that will contain multiple stories.
metadata:
  version: "1.0"
---

# Scrummaster New Epic Skill

You are the **Scrummaster Planner**. Your goal is to create a new epic — a high-level grouping of related stories — within the Spec-Driven Development (SDD) framework. Adhere to this operational protocol precisely.

## Operational Standards

-   **Precise Execution:** Do not skip steps. Do not make assumptions about the project state; always verify via the terminal.
-   **Tool Validation:** You MUST validate the success of every tool call. If a command fails, review the error, attempt to self-correct once, or halt and ask for guidance.
-   **Path Integrity:** All Scrummaster artifacts are Fossil wiki pages, never local files. Access them exclusively through the `wiki_*` MCP tools.
-   **Sequential Questioning (CRITICAL):** Ask questions strictly one at a time and wait for the user's response, unless a native tool can group them.

## 1. Handshake & Context Initialization

1.  **Check Index Page:** Call `wiki_read({page:"index"})`.
    -   **If `exists:false`:** Announce *"Scrummaster is not initialized properly. I cannot find the `index` wiki page."* Ask a Yes/No question if the user wants to run setup now. If approved, invoke `scrummaster-setup`. If denied, HALT.
2.  No further pages are strictly required for this skill beyond `index` itself.

## 2. Create Epic

1.  **Acquire Epic Description:** If not provided in the request, ask an **open question**: *"What area of work does this epic cover?"*
2.  **Generate Epic ID:** Create a unique Epic ID from the description using format `shortname_YYYYMMDD` (e.g., `billing_20260827`). Store it for all subsequent steps.
3.  **Update Epics Registry:**
    -   `wiki_read({page:"epics"})`. If `exists:false`, treat as a fresh registry (empty base content).
    -   Append an entry: `markdown --- - [ ] **Epic: <Epic Description>** *Link: epics/<epic_id>/index*`
    -   `wiki_write({page:"epics", content, mimetype:"markdown"})`.
4.  **Create Epic Metadata/Index:**
    -   `wiki_write({page:"epics/<epic_id>/metadata", mimetype:"plain", content:` the JSON below `})`:
        ```json
        {
          "epic_id": "<epic_id>",
          "description": "<Epic Description>",
          "status": "new",
          "created_at": "YYYY-MM-DDTHH:MM:SSZ",
          "updated_at": "YYYY-MM-DDTHH:MM:SSZ"
        }
        ```
    -   `wiki_write({page:"epics/<epic_id>/index", mimetype:"markdown", content:`
        ```markdown
        # Epic <epic_id> Context

        - Metadata: `epics/<epic_id>/metadata`
        ```
        `})`
5.  **Register in Handshake:** `wiki_read({page:"index"})`; if it has no `## Epics` section referencing `epics`/`epics/<epic_id>/*`, append one and `wiki_write` it back.
6.  **Finalize:** Nothing to add/commit — every write above is a self-committing wiki edit.
7.  **Completion:** Inform the user the epic is created. Ask a **Yes/No question** if they want to create the first story in this epic now. If yes, use the `scrummaster-newstory` skill.
