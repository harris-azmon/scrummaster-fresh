# General Code Style Guide

## Comments
- JSDoc/Python docstrings for public APIs
- Inline comments for non-obvious logic
- TODO/FIXME markers with `[ ]` for trackable items

## Imports
- Group: stdlib, third-party, local
- Alphabetical within each group
- No circular imports

## Error Handling
- Use typed error objects
- Always log with context
- Fail fast on unrecoverable errors

## Testing
- 80% minimum coverage
- Test descriptions in present tense
- Arrange-Act-Assert pattern