# F# Style Guide Summary

This document summarizes key rules and best practices from Microsoft's
official F# style guide (formatting guidelines + coding conventions).

## 1. Formatting

-   **Indentation:** Spaces only, never tabs (the compiler errors on a stray
    tab outside a string/comment). 4 spaces per level is the recommended
    default; fewer is acceptable if used consistently throughout the
    codebase.
-   **Formatter:** Use [Fantomas](https://github.com/fsprojects/fantomas)
    — the community-standard auto-formatter, whose defaults match this
    guide. Prefer running it over manually litigating formatting.
-   **Avoid length-sensitive alignment:** Never indent a continuation to
    line up with a variable/expression name (`|>` aligned under a long
    identifier, a `match ... with` wrapped mid-expression). Break to a new
    line and indent one level instead — renames shouldn't reflow
    unrelated lines.
-   **No extraneous whitespace:** `spam (ham 1)`, not `spam ( ham 1 )`.
-   **Blank lines:** One blank line between top-level bindings/types; one
    blank line before an XML doc comment (`///`).

## 2. Naming

-   **PascalCase:** Types, modules, members, constructors, exceptions,
    publicly exposed functions/values, `[<Literal>]` values, and generic
    type parameters (prefer a descriptive PascalCase name, e.g. `'Document`,
    over a bare `'a` outside truly generic code).
-   **camelCase:** Local `let`-bound values, function parameters,
    private/internal values, and custom computation-expression operations.

## 3. Expressions

-   **Omit unneeded parens:** `someFunction x.Name`, not
    `someFunction (x.Name)`; keep them only when required by precedence.
-   **Space before `(` depends on casing:** a lower-case function/member
    applied to a tupled argument gets a space (`someFunction (a + b)`); a
    capitalized one (typically a constructor or fluent member) does not
    (`String.Format(a, b)`, `SomeClass.Invoke()`).
-   **Curried multi-arg calls:** never omit the space between arguments:
    `someFunction (f x) (g y)`, not `someFunction(f x)(g y)`.
-   **Pipelines:** in a multi-line pipeline, put each `|>` stage on its own
    line, with the operator under the expression it operates on — never
    trailing the previous line.
-   **Binary operators:** always spaced (`x - 1 + 3`); a unary `-` is never
    spaced from its operand (`-x`, not `- x`).
-   Prefer the standard library's operators (`|>`, `<|`, `>>`, `+`, `&&`,
    `|||`, etc.) over hand-rolled equivalents.
-   **Long argument lists:** when a call doesn't fit one line, indent all
    arguments one level, one per line; when the last argument is a lambda,
    keep the leading arguments on the call's line and open the lambda
    inline.

## 4. Declarations

-   **Records:** `{ Field = value; ... }`; on multiple lines, align fields
    with `{`, or put `{`/`}` on their own lines — pick one convention and
    keep it consistent within a file.
-   **Discriminated unions:** indent the leading `|` by 4 spaces; omit it
    only for a single-case DU (`type Address = Address of string`).
-   **Long parameter lists:** one parameter per line, indented one level;
    for curried parameters, put the trailing `=` (and return type, if any)
    on its own line.
-   Separate members and top-level bindings with a single blank line;
    document public members with `///`, with a blank line before the
    comment.
-   **Return types:** annotate them explicitly on public members — treat
    the annotation as compiler-checked documentation of your API's shape,
    rather than relying on inference to decide it for you.

## 5. Code Organization

-   **Prefer namespaces over top-level modules** for anything publicly
    consumable: a namespace compiles to a real .NET namespace, while a
    top-level module compiles to a static class that surprises C#
    consumers.
-   **Sort `open` statements topologically** (by dependency layer, then
    alphabetically within a layer) — not alphabetically overall. Unlike
    C#'s `using`, F#'s `open` order affects name shadowing, so reordering
    can silently change behavior.
-   Use `[<RequireQualifiedAccess>]` when names are likely to collide, or
    when forcing qualification aids readability.
-   Use `[<AutoOpen>]` sparingly — it obscures where a name came from.
    Reasonable use: hiding a `private` helper module inside a larger
    public API.
-   **Keep side-effecting dependencies (config, DB/network handles,
    non-thread-safe state) in a class, not as module-level `let`
    bindings.** Module initialization compiles to a static constructor;
    an error there surfaces as an opaque, permanently-cached
    `TypeInitializationException` for the process's lifetime.

## 6. Error Handling

-   **Model expected/domain failure modes as data** — a discriminated
    union, or `Result<'T, 'Error>` for simple, non-nested cases — not as
    exceptions. This puts the compiler in charge of making sure every
    failure case is actually handled.
-   **Reserve exceptions for genuinely exceptional, unrepresentable
    faults.** Prefer `nullArg` / `invalidArg` / `invalidOp` / `raise` with
    a specific exception type over the untyped `failwith` / `failwithf`.
-   **Don't use `Result` as a blanket replacement for exceptions.** Nesting
    `Result<Result<T, string>, string list>`, or stuffing an exception
    into an `Error` case, just reinvents checked exceptions with worse
    ergonomics and "stringly typed" error matching. Catch the *specific*
    exception type you expect and translate it into a meaningful domain
    value instead of swallowing everything with a bare `with _ -> None`.

## 7. Functional-First Idioms

-   Values are immutable by default; reach for `mutable` only where
    performance genuinely requires it, and keep its scope as narrow as
    possible (nest it inside the smallest enclosing `let`). Prefer
    `let mutable` over `ref`.
-   **Avoid partial application / point-free style in public APIs** —
    curried, point-free values lose their argument names in tooling and
    are effectively undebuggable (no bound values to inspect). Point-free
    style is fine for reducing internal boilerplate (e.g. test helpers).
-   Favor composition and object expressions over class inheritance; avoid
    building inheritance-based type hierarchies.
-   Avoid `null`, `AllowNullLiteral`, `Unchecked.defaultof<_>`, and
    `DefaultValue` — represent "nothing" with `Option`.
-   **Don't use a type abbreviation to model a domain concept**
    (`type BufferSize = int`) — it isn't a real abstraction, doesn't show
    up in compiled IL, and silently accepts any `int`. Use a single-case
    discriminated union instead (`type BufferSize = BufferSize of int`),
    which forces callers to construct one deliberately.

**BE CONSISTENT.** When editing code, match the existing style — and
prefer letting Fantomas settle formatting questions over hand-litigating
them.

*Source:
[F# code formatting guidelines](https://learn.microsoft.com/en-us/dotnet/fsharp/style-guide/formatting)
&
[F# coding conventions](https://learn.microsoft.com/en-us/dotnet/fsharp/style-guide/conventions)*
