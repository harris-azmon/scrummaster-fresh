# General Code Style Principles

This document outlines general coding principles that apply across all languages
and frameworks used in this project.

## Readability

-   Code should be easy to read and understand by humans.
-   Avoid overly clever or obscure constructs.

## Consistency

-   Follow existing patterns in the codebase.
-   Maintain consistent formatting, naming, and structure.

## Simplicity

-   Prefer simple solutions over complex ones.
-   Break down complex problems into smaller, manageable parts.
-   Check `tech-stack.md`'s Engineering Priorities ranking before trading
    simplicity for performance (or vice versa). If the project has
    explicitly ranked memory use, allocation/GC pressure, throughput, or
    latency above simplicity, that ordering governs the code paths it
    targets — most code should still default to simple, but don't
    "clean up" a deliberately non-simple hot path back toward simplicity
    without checking why it's written that way.

## Abstraction

-   Do not introduce interfaces, dependency injection, factories, or other
    indirection whose only justification is making a unit mockable in
    isolation. If the abstraction would disappear the moment the test
    requirement disappears, don't add it.
-   Add a seam only when the design itself needs it (e.g. a genuinely
    swappable real implementation, a plugin point, a documented external
    boundary) — never solely to satisfy a test.
-   Prefer testing through the real, concrete implementation. Reserve
    mocking for boundaries that are impractical to exercise directly
    (network calls, third-party services, non-deterministic clocks).
-   Testability-driven abstraction is a cost, not a virtue: it adds
    indirection that must be understood and preserved across every future
    edit, with no user-facing benefit. This cost compounds under agentic
    authorship, where the abstraction's original rationale doesn't persist
    across sessions — an agent will either propagate seams it can't
    justify or silently collapse ones a test still depends on. Prefer
    clean, direct code over defensive abstraction.

## Maintainability

-   Write code that is easy to modify and extend.
-   Minimize dependencies and coupling.

## Documentation

-   Document *why* something is done, not just *what*.
-   Keep documentation up-to-date with code changes.
