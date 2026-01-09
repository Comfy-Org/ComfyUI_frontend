# Claude Code specific instructions

@Agents.md

## Repository Setup

For first-time setup, use the Claude command:

```sh
/setup_repo
```

This bootstraps the monorepo with dependencies, builds, tests, and dev server verification.

**Prerequisites:** Node.js >= 24, Git repository, available ports for dev server, storybook, etc.

## Development Workflow

1. **First-time setup**: Run `/setup_repo` Claude command
2. Make code changes
3. Run tests (see subdirectory CLAUDE.md files)
4. Run typecheck, lint, format
5. Check README updates
6. Consider docs.comfy.org updates

## Git Conventions

- Use `prefix:` format: `feat:`, `fix:`, `test:`
- Add "Fixes #n" to PR descriptions
- Never mention Claude/AI in commits
