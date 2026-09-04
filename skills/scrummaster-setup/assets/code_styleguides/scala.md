# Scala Style Guide Summary

This document summarizes key rules and best practices from the official
[Scala Style Guide](https://docs.scala-lang.org/style/).

## 1. Indentation & Line Wrapping

-   **2 spaces** per indentation level. Never tabs.
-   Prefer breaking a long expression into named intermediate values over
    wrapping a single line across multiple lines.
-   When wrapping is unavoidable, indent the continuation 2 spaces; a
    wrapped line must end mid-expression (an unclosed paren, or a trailing
    infix operator) — never end clean and start the next line with an
    operator.
-   **Methods with 5+ parameters:** one parameter per line, indented 2
    spaces from the call.
-   Don't indent parameters more than ~50 columns to align them; past that
    point, move the whole invocation to the next line instead.
-   Prefer designing methods that take 2–3 parameters or fewer in the
    first place.

## 2. Naming Conventions

-   **Classes/Traits:** UpperCamelCase (`class MyFairLady`).
-   **Objects:** UpperCamelCase, like classes — except lowercase when the
    object mimics a package or a function (`object inc`).
-   **Packages:** standard Java reverse-domain naming
    (`package com.novell.coolness`); avoid single-segment names.
-   **Methods:** lowerCamelCase (`def myFairMethod`). An accessor is the
    bare property name (`def bar`); a boolean accessor may take an `is`
    prefix (`isBaz`); a mutator takes a `_=` suffix (`def bar_=(bar: Bar)`).
-   **Parentheses on arity-0 methods:** include them if the method has a
    side effect; omit them if it's a pure, value-returning accessor.
-   **Constants:** UpperCamelCase (`val MyConstant`, defined in an object
    or package). **Values/variables:** lowerCamelCase (`val myValue`).
-   **Type parameters:** a single uppercase letter for generic/simple
    cases (`class List[A]`); descriptive UpperCamelCase names when the
    parameter has domain meaning (`class Map[Key, Value]`); short
    mnemonics are fine in a tight scope (`class Map[K, V]`). For
    higher-kinded types, prefer a descriptive name, falling back to a
    single letter only for fundamental concepts (`F[_]`, `M[_]`).
-   **Annotations:** lowerCamelCase (`@volatile`).

## 3. Types

-   **Type inference:** omit annotations on private fields and local
    values when the type is immediately evident from the right-hand side;
    lean on Scala's function-parameter inference when the context already
    establishes the type (`ls.map(str => str.toInt)` needs no parameter
    annotation once `ls: List[String]` is known).
-   **Public methods:** always give an explicit type annotation. This
    protects your API's shape from silently changing when an internal
    inferred type changes.
-   **Annotation syntax:** `value: Type`, with a space after the colon —
    this also avoids ambiguity with operators like `:::`. The same spacing
    applies to type ascription (`Nil: List[String]`, `Set(values: _*)`).
-   **Function types:** space around the arrow (`Int => String`); omit
    parens around a single parameter (`Int => String => Boolean`, not
    `(Int) => (String) => Boolean`).
-   **Structural types:** inline if under ~50 characters; otherwise pull
    into a type alias. Prefer nominal types generally — structural types
    rely on reflection and cost performance.

## 4. Nested Blocks

-   **Curly braces open on the same line** as the declaration
    (`def foo = {`), never on the following line — Scala's semicolon
    inference behaves unpredictably with GNU-style opening braces.
-   **Multi-line parenthesized expressions:** keep the parens unspaced and
    on the same lines as their content (Lisp-style); a trailing closing
    paren alone on its own line is acceptable for readability. Wrapping an
    expression in parens is also a legitimate way to disable semicolon
    inference so a line can start with an operator.

## 5. Control Structures

-   Always a space after the keyword: `if (foo)`, `for (i <- 0 to 10)`,
    `while (true)`.
-   **`if`:** omit braces when there's an `else` clause; otherwise brace
    the body even if it's one line.
-   **`while`:** never omit braces.
-   **`for`:** omit braces when there's a `yield`; otherwise brace the
    body even if it's one line.
-   **`case` clauses:** never brace them.
-   **For-comprehensions with multiple generators:** curly braces, one
    generator per line:
    ```scala
    for {
      x <- board.rows
      y <- board.files
    } yield (x, y)
    ```
    A single-generator comprehension stays inline with parens:
    `for (i <- 0 to 10) yield i`. A multi-generator loop with no `yield`
    uses parens and semicolons instead of braces.
-   **Trivial conditionals** may stay on one line only for short,
    purely-functional expressions (`val res = if (foo) bar else baz`) —
    never for imperative code or anything requiring braces.

## 6. Declarations

-   **Constructors:** all on one line unless it exceeds ~100 characters;
    past that, one argument per line with trailing commas, and a blank
    line before the class body if the `extends` clause also wrapped.
-   **Member ordering:** fields before methods. Adjacent `val`/`var`
    fields may be grouped without blank lines only when each is short
    (≤20 chars), single-line, and undocumented.
-   **Return types:** required on every public member, as compiler-checked
    documentation; may be omitted on private/local methods.
-   **Method body placement:** same line as `def` if short (~<30 chars);
    indented 2 spaces on the next line if medium (~30–70 chars); braced if
    longer or multi-statement. A `match` goes directly after `=` with no
    extra braces around it.
-   **Modifier order:** annotations (each on its own line), `override`,
    access modifier (`protected`/`private`), `implicit`, `final`, `def`.
-   **Multiple parameter lists** only when needed: fluent/control-structure
    APIs, isolating `implicit` parameters, or aiding type inference on a
    later parameter.
-   **Function values:** prefer an explicit, type-annotated form
    (`val f: (Int, Int) => Int = (_ + _)`) over underscore-heavy syntax
    that obscures what's being defined (`val f = (_: Int) + (_: Int)`).

## 7. Method Invocation

-   No space between receiver, `.`, method name, and the opening paren:
    `target.foo(42, bar)`. One space after each comma; spaces around `=`
    in named arguments (`foo(x = 6, y = 7)`).
-   **Arity-0:** omit parens only for methods with no side effects
    (`queue.size`); keep parens for anything side-effecting (`reply()`).
-   **Arity-1:** prefer dot notation (`names.mkString(",")`) over infix.
    Symbolic operators are the exception — always infix, always spaced
    (`a + b`, never `a.+(b)`).
-   **Higher-order functions:** dot notation with no space before the
    paren (`names.map(_.toUpperCase)`) — not `names map (_.toUpperCase)`
    or `names.map (_.toUpperCase)`.

## 8. Files

-   A class/trait/object definition lives entirely in one file; a class
    and its companion object are defined together in that same file, and
    all subclasses of a `sealed` class must live there too.
-   Name the file after the class it contains (or the parent class, if it
    holds a small family of related types, e.g. a sealed ADT). A package
    object goes in a file named `package.scala`.

## 9. Scaladoc

-   Document public packages, classes, objects, traits, and members with
    Scaladoc (`/** ... */`).

**BE CONSISTENT.** The guide itself says to "treat this document as a
list of rules to be broken" when there's a good reason — but default to
following it, and match whatever convention is already established in a
given file.

*Source: [Scala Style Guide](https://docs.scala-lang.org/style/)*
