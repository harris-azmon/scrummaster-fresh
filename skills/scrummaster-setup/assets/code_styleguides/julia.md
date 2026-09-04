# Julia Style Guide Summary

This document summarizes key rules and best practices from the official
Julia Manual's [Style Guide](https://docs.julialang.org/en/v1/manual/style-guide/).

## 1. Formatting

-   **Indentation:** 4 spaces per level.
-   Omit unnecessary parentheses around conditions: `if a == b`, not
    `if (a == b)`.

## 2. Naming Conventions

-   **Modules/Types:** CapitalizedCamelCase, no underscores (`SparseArrays`,
    `UnitRange`).
-   **Functions/variables:** lowercase, words concatenated when short and
    unambiguous (`maximum`, `isequal`, `haskey`); underscores are fine as
    word separators for longer or compound names (`remotecall_fetch`).
-   Avoid abbreviations (`indexin`, not `indxin`).
-   **Mutating functions:** append `!` to any function name that modifies
    one of its arguments (`sort!` vs. `sort`).

## 3. Function & Program Structure

-   Prefer functions over top-level script code as soon as practical —
    functions are what the compiler specializes and optimizes, and what
    makes code reusable and testable. Don't leave a program as a
    sequence of top-level steps longer than necessary.
-   Pass functions directly instead of wrapping them trivially:
    `map(f, a)`, not `map(x -> f(x), a)`.
-   Decide whether a concept is a type or an instance of one (`MyType` vs.
    `MyType()`) and stay consistent about which.

## 4. Type Design

-   Prefer generic, duck-typed signatures over concrete ones: define
    `complex(float(x))` rather than special-casing `Complex{Float64}(x)`.
    Julia compiles a specialized version per call site automatically, so
    staying generic costs nothing at runtime.
-   Prefer an abstract argument type (`Integer`) over a concrete one
    (`Int`) when the implementation doesn't actually require a specific
    representation; omit the annotation entirely when duck typing is
    enough.
-   Push type conversions into the caller rather than converting inside
    the callee — keep function signatures generic.
-   Avoid `foo(x::T) where {T<:Real}` when `foo(x::Real)` says the same
    thing with less ceremony; reserve `where` for when the type parameter
    is actually reused elsewhere in the signature.
-   A constructor must return an instance of its own type — `T(x)` should
    never return something other than a `T`.
-   Use `isa`/`<:` for type testing, not `==` — exact equality only makes
    sense for a known concrete type.

## 5. Collections & Literals

-   A complex `Union` type in a field or collection (e.g.
    `Union{Function,AbstractString}`) is usually a design smell — reach
    for `Vector{Any}` or a proper abstraction instead.
-   Prefer concatenation (`[a; b]`) over splicing both sides
    (`[a..., b...]`).
-   In generic numeric code, prefer integer literals over float literals:
    `g(x) = 2 * x`, not `f(x) = 2.0 * x`. Multiplying by a `Float64`
    literal promotes the result even when the caller passed an `Int`,
    silently changing the function's return type.

## 6. Error Handling

-   Prefer avoiding an error condition (validate/guard first) over
    relying on `try`/`catch` to recover from it after the fact.

## 7. API Design

-   Prefer exported functions over direct field access on a type — it
    keeps the internal representation free to change later, and lets the
    accessor be passed around as a first-class function (e.g. into `map`).
-   Don't give an unsafe operation (one that can segfault or corrupt
    memory if misused) a normal-looking name; if you must expose one,
    put "unsafe" in the name.
-   Avoid type piracy: don't extend a method you don't own (from `Base`
    or another package) on a type you don't own either — it silently
    changes behavior other code depends on.
-   Prefer a function to a macro wherever a function will do; needing
    `eval` inside a macro is a sign the macro is the wrong tool.

## 8. Argument Ordering

When nothing else constrains the order, arrange parameters:

1.  The function argument (enables `do`-block syntax)
2.  I/O stream
3.  Input being mutated
4.  Type
5.  Input not being mutated
6.  Key
7.  Value
8.  Everything else
9.  Varargs
10. Keyword arguments

**BE CONSISTENT.** As the guide itself puts it, none of these rules are
absolute — they're suggestions to keep code idiomatic, not a checklist to
follow mechanically.

*Source:
[Julia Manual — Style Guide](https://docs.julialang.org/en/v1/manual/style-guide/)*
