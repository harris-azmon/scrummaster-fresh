# Project Workflow

## Guiding Principles

1.  **The Plan is the Source of Truth:** All work must be tracked on the
    story's `plan` wiki page
2.  **The Tech Stack is Deliberate:** Changes to the tech stack must be
    documented on the `tech-stack` wiki page *before* implementation
3.  **Test-Driven Development:** Write unit tests before implementing
    functionality
4.  **High Code Coverage:** Aim for >80% code coverage for all modules
5.  **User Experience First:** Every decision should prioritize user experience
6.  **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use
    `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Flow Control (Kanban WIP Limits)

Scrummaster's board has three effective lanes: **Ready** (stories at `[~]`,
being drafted/implemented by an agent), **Review** (stories at `[x]` in the
registry whose metadata page has `review_entered_at` set but `done_at`
still `null` — i.e. implementation finished but acceptance hasn't), and
**Done** (`done_at` set). There is no queueing *within* Ready — one agent
runs spec → plan → implement back-to-back on a story — so a WIP limit there
is a resource cap, not a flow-discipline device. Review is where a human
reviewer's fixed bandwidth meets elastic agent throughput, so its limit is
the one that actually governs the system's pull rate.

Set these here if you want `scrummaster-implement` to stop pulling new
stories when a lane is full, and `scrummaster-status` to report WIP and
Review-queue age against them. Leave any of them unset (or omit this
section) to disable that limit — the default is uncapped, matching prior
behavior.

-   **`ready_wip_limit`**: max stories concurrently at `[~]`. Set this to the
    number of concurrent agent workers you actually run against this
    checkout — it's a concurrency cap, not a convention. *(unset = uncapped)*
-   **`review_wip_limit`**: max stories concurrently in Review. This is the
    throttle valve: size it with Little's Law (`WIP = Throughput ×
    Cycle Time`) from your real review throughput and tolerable acceptance
    time, not by guessing. *(unset = uncapped)*
-   **`review_sla_hours`**: if a story has been in Review longer than this,
    `scrummaster-status` flags it regardless of whether Review is within its
    WIP cap — a card can be "within limit" and still be stale if review
    capacity is bursty. *(unset = no SLA flag)*
-   **`claim_lease_hours`**: how long a story's claim (see below) stays valid
    without being renewed before another agent may take it over. Set this if
    you run multiple concurrent agent workers and want a crashed/abandoned
    worker's claim to expire automatically rather than blocking the story
    forever. *(unset = claims never expire on their own; a stuck claim needs
    manual intervention — e.g. `scrummaster-revert` on the story, which
    clears it)*

### Story Claims (multi-agent safety)

`ready_wip_limit` caps how many *different* stories can be in flight at
once; it does nothing to stop two concurrent `scrummaster-implement` runs
from both picking the *same* story. Claims solve that: each story's
metadata carries `claimed_by` (a short id `scrummaster-implement` generates
once per run) and `claimed_at`. Before moving a story to `[~]`,
`scrummaster-implement` checks the claim, and re-checks it immediately
before writing, to keep the race window as narrow as possible.

**This is best-effort, not a real lock.** Fossil wiki writes aren't
compare-and-swap — two agents can still both read "unclaimed" in the same
instant and both write a claim. It shrinks the collision window a lot (a
single `wiki_read` + `wiki_write` pair right before the state change,
instead of the whole story-selection conversation) but doesn't eliminate
it. If you need a hard guarantee, don't run two agents against the same
checkout without external coordination.

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1.  **Select Task:** Choose the next available task from the story's `plan`
    wiki page in sequential order

2.  **Mark In Progress:** Before beginning work, edit the plan page's text and
    change the task from `[ ]` to `[~]`, then write it back (`wiki_write`)

3.  **Write Failing Tests (Red Phase):**

    -   Create a new test file for the feature or bug fix.
    -   Write one or more unit tests that clearly define the expected behavior
        and acceptance criteria for the task.
    -   **CRITICAL:** Run the tests and confirm that they fail as expected. This
        is the "Red" phase of TDD. Do not proceed until you have failing tests.

4.  **Implement to Pass Tests (Green Phase):**

    -   Write the minimum amount of application code necessary to make the
        failing tests pass.
    -   Run the test suite again and confirm that all tests now pass. This is
        the "Green" phase.

5.  **Refactor (Optional but Recommended):**

    -   With the safety of passing tests, refactor the implementation code and
        the test code to improve clarity, remove duplication, and enhance
        performance without changing the external behavior.
    -   Rerun tests to ensure they still pass after refactoring.

6.  **Verify Coverage:** Run coverage reports using the project's chosen tools.
    For example, in a Python project, this might look like: `bash pytest
    --cov=app --cov-report=html` Target: >80% coverage for new code. The
    specific tools and commands will vary by language and framework.

7.  **Document Deviations:** If implementation differs from tech stack:

    -   **STOP** implementation
    -   Update the `tech-stack` wiki page with the new design
    -   Add dated note explaining the change
    -   Resume implementation

8.  **Commit Code Changes:**

    -   Add all code changes related to the task: `fossil_add({paths:[...]})`.
    -   Propose a clear, concise commit message e.g, `feat(ui): Create basic
        HTML structure for calculator`.
    -   Perform the commit: `fossil_commit({message:"<message>"})`. Its result
        carries the new commit's `hash`/`hash_short` directly — nothing further
        is needed to obtain it.

9.  **Record Task Summary:**

    -   Fossil has no Git Notes; put the task summary directly in the commit
        message. The summary should include the task name, a summary of changes,
        a list of all created/modified files, and the core "why" for the change.

10. **Update the Plan Page:**

    -   Read the story's `plan` wiki page (`wiki_read`), find the line for the
        completed task, update its status from `[~]` to `[x]`, and append
        `hash_short` from step 8's commit result.
    -   Write the updated content back: `wiki_write({page:"stories/<story_id>/plan", ...})`.
    -   Nothing to add/commit for this — it's a self-committing wiki edit, not a
        checkout file change.

### Task Correction & Plan Amendment Workflows

When an implemented task or phase requires corrections, amendments, or additions, follow these standard workflows to maintain plan integrity and avoid untracked code drift:

1.  **In-Flight Refinements:** If minor gaps are found while a task is actively
    in-progress (`[~]`), make the adjustments directly in the active
    implementation stream and ensure passing tests before committing.
2.  **Code Review Corrections (`scrummaster-review`):** If issues are identified
    during or after a code review, instruct the agent to review your changes
    (e.g., *"run a review"* or triggering the action manually in compatible
    clients). The review agent will automatically append a `Review Fixes` phase
    to the story's `plan` wiki page so that correction tasks are formally
    tracked and checkpointed.
3.  **Logical State Reversions (`scrummaster-revert`):** If a task implementation
    is fundamentally flawed or needs to be redone, instruct the agent to revert
    the changes (e.g., *"revert the last task"* or triggering the action
    manually in compatible clients). This reverts the affected files with
    Fossil (`fossil_revert`) and resets the task state on the `plan` wiki page
    back to pending `[ ]` to allow a clean restart.

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed
that also concludes a phase on the story's `plan` wiki page.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and
    the verification and checkpointing protocol has begun.

2.  **Ensure Test Coverage for Phase Changes:**

    -   **Step 2.1: Determine Phase Scope:** To identify the files changed in
        this phase, you must first find the starting point. `wiki_read` the
        `plan` page to find the commit hash of the *previous* phase's
        checkpoint. If no previous checkpoint exists, the scope is all changes
        since the first commit.
    -   **Step 2.2: List Changed Files:** Call `fossil_changes({differ:true})`
        (or `fossil_diff({brief:true, from_checkin:"<previous_checkpoint_hash>", to_checkin:"current"})`
        for a range) to get a precise list of all files modified during this
        phase.
    -   **Step 2.3: Verify and Create Tests:** For each file in the list:
        -   **CRITICAL:** First, check its extension. Exclude non-code files
            (e.g., `.json`, `.md`, `.yaml`).
        -   For each remaining code file, verify a corresponding test file
            exists.
        -   If a test file is missing, you **must** create one. Before writing
            the test, **first, analyze other test files in the repository to
            determine the correct naming convention and testing style.** The new
            tests **must** validate the functionality described in this phase's
            tasks (the `plan` wiki page).

3.  **Execute Automated Tests with Proactive Debugging:**

    -   Before execution, you **must** announce the exact shell command you will
        use to run the tests.
    -   **Example Announcement:** "I will now run the automated test suite to
        verify the phase. **Command:** `CI=true npm test`"
    -   Execute the announced command.
    -   If tests fail, you **must** inform the user and begin debugging. You may
        attempt to propose a fix a **maximum of two times**. If the tests still
        fail after your second proposed fix, you **must stop**, report the
        persistent failure, and ask the user for guidance.

4.  **Propose a Detailed, Actionable Manual Verification Plan:**

    -   **CRITICAL:** To generate the plan, first analyze the `product`,
        `product-guidelines`, and `plan` wiki pages to determine the
        user-facing goals of the completed phase.
    -   You **must** generate a step-by-step plan that walks the user through
        the verification process, including any necessary commands and specific,
        expected outcomes.
    -   The plan you present to the user **must** follow this format:

        **For a Frontend Change:** ``` The automated tests have passed. For
        manual verification, please follow these steps:

        **Manual Verification Steps:** 1. **Start the development server with
        the command:** `npm run dev` 2. **Open your browser to:**
        `http://localhost:3000` 3. **Confirm that you see:** The new user
        profile page, with the user's name and email displayed correctly. ```

        **For a Backend Change:** ``` The automated tests have passed. For
        manual verification, please follow these steps:

        **Manual Verification Steps:** 1. **Ensure the server is running.** 2.
        **Execute the following command in your terminal:** `curl -X POST
        http://localhost:8080/api/v1/users -d '{"name": "test"}'` 3. **Confirm
        that you receive:** A JSON response with a status of `201 Created`. ```

5.  **Await Explicit User Feedback:**

    -   After presenting the detailed plan, ask the user for confirmation:
        "**Does this meet your expectations? Please confirm with yes or provide
        feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an
        explicit yes or confirmation.

6.  **Identify Target Commit for Report:**

    -   Do NOT create a new empty commit for checkpointing.
    -   The hash of the last functional commit made during this phase is
        already known — it's the `hash`/`hash_short` from that task's own
        `fossil_commit` result (Standard Task Workflow step 8). This is the
        target for the verification report.

7.  **Record Auditable Verification Report:**

    -   **Step 7.1: Draft Report Content:** Create a detailed verification report
        including the automated test command, the manual verification steps, and
        the user's confirmation.
    -   **Step 7.2: Record:** Fossil has no Git Notes; append the verification
        report to the phase's checkpoint entry on the `plan` wiki page.

8.  **Update the Plan Page's Checkpoint:**

    -   `wiki_read` the `plan` page, find the heading for the completed phase,
        and append the phase's last task's `hash_short` (from step 6, already
        in hand) in the format `[checkpoint: <hash_short>]`.
    -   `wiki_write({page:"stories/<story_id>/plan", ...})` with the updated
        content. Nothing to add/commit for this — it's a self-committing wiki
        edit, not a checkout file change.

9.  **Announce Completion:** Inform the user that the phase is complete and the
    checkpoint has been created, with the detailed verification report recorded
    on the plan page.

### Quality Gates

Before marking any task complete, verify:

-   [ ] All tests pass
-   [ ] Code coverage meets requirements (>80%)
-   [ ] Code follows project's code style guidelines (as defined in
    `code_styleguides/`)
-   [ ] All public functions/methods are documented (e.g., docstrings, JSDoc,
    GoDoc)
-   [ ] Type safety is enforced (e.g., type hints, TypeScript types, Go types)
-   [ ] No linting or static analysis errors (using the project's configured
    tools)
-   [ ] Works correctly on mobile (if applicable)
-   [ ] Documentation updated if needed
-   [ ] No security vulnerabilities introduced

## Development Commands

**AI AGENT INSTRUCTION: This section should be adapted to the project's specific
language, framework, and build tools.**

### Setup

```bash
# Example: Commands to set up the development environment (e.g., install dependencies, configure database)
# e.g., for a Node.js project: npm install
# e.g., for a Go project: go mod tidy
```

### Daily Development

```bash
# Example: Commands for common daily tasks (e.g., start dev server, run tests, lint, format)
# e.g., for a Node.js project: npm run dev, npm test, npm run lint
# e.g., for a Go project: go run main.go, go test ./..., go fmt ./...
```

### Before Committing

```bash
# Example: Commands to run all pre-commit checks (e.g., format, lint, type check, run tests)
# e.g., for a Node.js project: npm run check
# e.g., for a Go project: make check (if a Makefile exists)
```

## Testing Requirements

### Unit Testing

-   Every module must have corresponding tests.
-   Use appropriate test setup/teardown mechanisms (e.g., fixtures,
    beforeEach/afterEach).
-   Mock external dependencies.
-   Test both success and failure cases.

### Integration Testing

-   Test complete user flows
-   Verify database transactions
-   Test authentication and authorization
-   Check form submissions

### Mobile Testing

-   Test on actual iPhone when possible
-   Use Safari developer tools
-   Test touch interactions
-   Verify responsive layouts
-   Check performance on 3G/4G

## Code Review Process

### Self-Review Checklist

Before requesting review:

1.  **Functionality**

    -   Feature works as specified
    -   Edge cases handled
    -   Error messages are user-friendly

2.  **Code Quality**

    -   Follows style guide
    -   DRY principle applied
    -   Clear variable/function names
    -   Appropriate comments

3.  **Testing**

    -   Unit tests comprehensive
    -   Integration tests pass
    -   Coverage adequate (>80%)

4.  **Security**

    -   No hardcoded secrets
    -   Input validation present
    -   SQL injection prevented
    -   XSS protection in place

5.  **Performance**

    -   Database queries optimized
    -   Images optimized
    -   Caching implemented where needed

6.  **Mobile Experience**

    -   Touch targets adequate (44x44px)
    -   Text readable without zooming
    -   Performance acceptable on mobile
    -   Interactions feel native

## Commit Guidelines

### Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

-   `feat`: New feature
-   `fix`: Bug fix
-   `docs`: Documentation only
-   `style`: Formatting, missing semicolons, etc.
-   `refactor`: Code change that neither fixes a bug nor adds a feature
-   `test`: Adding missing tests
-   `chore`: Maintenance tasks

### Examples

```bash
fossil commit -m "feat(auth): Add remember me functionality"
fossil commit -m "fix(posts): Correct excerpt generation for short posts"
fossil commit -m "test(comments): Add tests for emoji reaction limits"
fossil commit -m "style(mobile): Improve button touch targets"
```

## Definition of Done

A task is complete when:

1.  All code implemented to specification
2.  Unit tests written and passing
3.  Code coverage meets project requirements
4.  Documentation complete (if applicable)
5.  Code passes all configured linting and static analysis checks
6.  Works beautifully on mobile (if applicable)
7.  Implementation notes added to the `plan` wiki page
8.  Changes committed with proper message
9.  Task summary included in the commit message

## Emergency Procedures

### Critical Bug in Production

1.  Create hotfix branch from main
2.  Write failing test for bug
3.  Implement minimal fix
4.  Test thoroughly including mobile
5.  Deploy immediately
6.  Document in plan.md

### Data Loss

1.  Stop all write operations
2.  Restore from latest backup
3.  Verify data integrity
4.  Document incident
5.  Update backup procedures

### Security Breach

1.  Rotate all secrets immediately
2.  Review access logs
3.  Patch vulnerability
4.  Notify affected users (if any)
5.  Document and update security procedures

## Deployment Workflow

### Pre-Deployment Checklist

-   [ ] All tests passing
-   [ ] Coverage >80%
-   [ ] No linting errors
-   [ ] Mobile testing complete
-   [ ] Environment variables configured
-   [ ] Database migrations ready
-   [ ] Backup created

### Deployment Steps

1.  Merge feature branch to main
2.  Tag release with version
3.  Push to deployment service
4.  Run database migrations
5.  Verify deployment
6.  Test critical paths
7.  Monitor for errors

### Post-Deployment

1.  Monitor analytics
2.  Check error logs
3.  Gather user feedback
4.  Plan next iteration

## Continuous Improvement

-   Review workflow weekly
-   Update based on pain points
-   Document lessons learned
-   Optimize for user happiness
-   Keep things simple and maintainable
