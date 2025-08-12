# ComfyUI Frontend Project Guidelines

## Quick Commands

- `npm run`: See all available commands
- `npm run typecheck`: Type checking
- `npm run lint`: Linting
- `npm run format`: Prettier formatting
- `npm run test:component`: Run component tests with browser environment
- `npm run test:unit`: Run all unit tests
- `npm run test:unit -- tests-ui/tests/example.test.ts`: Run single test file

## Development Workflow

1. Make code changes
2. Run tests (see subdirectory CLAUDE.md files)
3. Run typecheck, lint, format
4. Check README updates
5. Consider docs.comfy.org updates

## Git Conventions

- Use [prefix] format: [feat], [bugfix], [docs]
- Add "Fixes #n" to PR descriptions
- Never mention Claude/AI in commits

## External Resources

- PrimeVue docs: <https://primevue.org>
- ComfyUI docs: <https://docs.comfy.org>
- Electron: <https://www.electronjs.org/docs/latest/>
- Wiki: <https://deepwiki.com/Comfy-Org/ComfyUI_frontend/1-overview>

## Project Philosophy

- Clean, stable public APIs
- Domain-driven design
- Thousands of users and extensions
- Prioritize clean interfaces that restrict extension access

## Repository Navigation

- Check README files in key folders (tests-ui, browser_tests, composables, etc.)
- Prefer running single tests for performance
- Use --help for unfamiliar CLI tools

## GitHub Integration

When referencing Comfy-Org repos:

1. Check for local copy
2. Use GitHub API for branches/PRs/metadata
3. Curl GitHub website if needed

## Common Pitfalls

- NEVER use `any` type - use proper TypeScript types
- NEVER use `as any` type assertions - fix the underlying type issue
- NEVER use `--no-verify` flag when committing
- NEVER delete or disable tests to make them pass
- NEVER circumvent quality checks
