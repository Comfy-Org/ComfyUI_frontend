# ComfyUI Frontend Project Guidelines

## Repository Setup

For first-time setup, use the Claude command:
```
/setup_repo
```
This bootstraps the monorepo with dependencies, builds, tests, and dev server verification.

**Prerequisites:** Node.js >= 24, Git repository, available ports (5173, 6006)

## Quick Commands

- `npm run`: See all available commands
- `npm run dev`: Start development server (port 5173, via nx)
- `npm run typecheck`: Type checking
- `npm run build`: Build for production (via nx)
- `npm run lint`: Linting (via nx)
- `npm run format`: Prettier formatting
- `npm run test:component`: Run component tests with browser environment
- `npm run test:unit`: Run all unit tests
- `npm run test:browser`: Run E2E tests via Playwright
- `npm run test:unit -- tests-ui/tests/example.test.ts`: Run single test file
- `npm run storybook`: Start Storybook development server (port 6006)
- `npm run knip`: Detect unused code and dependencies

## Monorepo Architecture

The project now uses **Nx** for build orchestration and task management:

- **Task Orchestration**: Commands like `dev`, `build`, `lint`, and `test:browser` run via Nx
- **Caching**: Nx provides intelligent caching for faster rebuilds
- **Configuration**: Managed through `nx.json` with plugins for ESLint, Storybook, Vite, and Playwright
- **Dependencies**: Nx handles dependency graph analysis and parallel execution

Key Nx features:
- Build target caching and incremental builds
- Parallel task execution across the monorepo
- Plugin-based architecture for different tools

## Development Workflow

1. **First-time setup**: Run `/setup_repo` Claude command
2. Make code changes
3. Run tests (see subdirectory CLAUDE.md files)
4. Run typecheck, lint, format
5. Check README updates
6. Consider docs.comfy.org updates

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
