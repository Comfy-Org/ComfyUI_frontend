---
globs:
  - '.github/**/*'
---

# Git & PR Workflow

## Commit Messages

Use `prefix:` format: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`

Never mention Claude/AI in commits.

## Pull Requests

- Reference linked issues: `Fixes #123`
- Keep descriptions concise and information-dense
- No emojis or excessive headers
- Follow the template in `.github/`
- Keep PRs focused — suggest splitting if >300 lines of non-test code

## Quality Gates (CI)

All must pass before merge:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm knip`
- Relevant tests

Never use `--no-verify` to bypass failing tests. If tests fail, identify root cause and fix or document blockers.
