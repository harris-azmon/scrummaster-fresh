# Python Code Style Guide

## Naming Conventions
- Functions: `snake_case`
- Classes: `CapWords`
- Variables: `snake_case`
- Constants: `UPPER_CASE`

## Formatting
- 4-space indentation
- Max line length: 88 characters
- Blank lines around top-level definitions

## Imports
- Standard library first
- Third-party second
- Local imports last

## Type Hints
- Use type hints for all function parameters and return values
- Prefer `Optional[Type]` over `Type | None`
- Use `TypedDict` for dictionary type hints