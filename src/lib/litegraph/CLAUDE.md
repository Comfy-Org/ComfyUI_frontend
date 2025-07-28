- This codebase has extensive eslint autofix rules and IDEs are configured to use eslint as the format on save tool. Run ESLint instead of manually figuring out whitespace fixes or other trivial style concerns. Review the results and correct any remaining eslint errors.
- Take advantage of `TypedArray` `subarray` when appropriate.
- The `size` and `pos` properties of `Rectangle` share the same array buffer (`subarray`); they may be used to set the rectangles size and position.
- Prefer single line `if` syntax over adding curly braces, when the statement has a very concise expression and concise, single line statement.
- Do not replace `&&=` or `||=` with `=` when there is no reason to do so. If you do find a reason to remove either `&&=` or `||=`, leave a comment explaining why the removal occurred.
- You are allowed to research code on https://developer.mozilla.org/ and https://stackoverflow.com without asking.
- When adding features, always write vitest unit tests using cursor rules in @.cursor
- When writing methods, prefer returning idiomatic JavaScript `undefined` over `null`.

# Bash commands

- `npm run typecheck` Run the typechecker
- `npm run build` Build the project
- `npm run lint:fix` Run ESLint

# Code style

- Always prefer best practices when writing code.
- Write using concise, legible, and easily maintainable code.
- Avoid repetition where possible, but not at the expense of code legibility.
- Type assertions are an absolute last resort. In almost all cases, they are a crutch that leads to brittle code.

# Workflow

- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
