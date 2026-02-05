# E2E Testing Guidelines

See `@docs/guidance/playwright.md` for Playwright best practices (auto-loaded for `*.spec.ts`).

## Directory Structure

- `assets/` - Test data (JSON workflows, fixtures)
- Tests use premade JSON workflows to load desired graph state

## After Making Changes

- Run `pnpm typecheck:browser` after modifying TypeScript files in this directory
- Run `pnpm exec eslint browser_tests/path/to/file.ts` to lint specific files
- Run `pnpm exec oxlint browser_tests/path/to/file.ts` to check with oxlint
