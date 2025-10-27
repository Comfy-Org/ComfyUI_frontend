# ComfyUI Frontend Project Guidelines

## Repository Setup

For first-time setup, use the Claude command:
```
/setup_repo
```
This bootstraps the monorepo with dependencies, builds, tests, and dev server verification.

**Prerequisites:** Node.js >= 24, Git repository, available ports (5173, 6006)

## Quick Commands

- `pnpm`: See all available commands
- `pnpm dev`: Start development server (port 5173, via nx)
- `pnpm typecheck`: Type checking
- `pnpm build`: Build for production (via nx)
- `pnpm lint`: Linting (via nx)
- `pnpm format`: Prettier formatting
- `pnpm test:unit`: Run all unit tests
- `pnpm test:browser`: Run E2E tests via Playwright
- `pnpm test:unit -- tests-ui/tests/example.test.ts`: Run single test file
- `pnpm storybook`: Start Storybook development server (port 6006)
- `pnpm knip`: Detect unused code and dependencies

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

- Follow good software engineering principles
  - YAGNI
  - AHA
  - DRY
  - SOLID
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

## Settings and Feature Flags Quick Reference

### Settings Usage
```typescript
const settingStore = useSettingStore()
const value = settingStore.get('Comfy.SomeSetting')     // Get setting
await settingStore.set('Comfy.SomeSetting', newValue)   // Update setting
```

### Dynamic Defaults
```typescript
{
  id: 'Comfy.Example.Setting',
  defaultValue: () => window.innerWidth < 1024 ? 'small' : 'large'  // Runtime context
}
```

### Version-Based Defaults
```typescript
{
  id: 'Comfy.Example.Feature',
  defaultValue: 'legacy',
  defaultsByInstallVersion: { '1.25.0': 'enhanced' }  // Gradual rollout
}
```

### Feature Flags
```typescript
if (api.serverSupportsFeature('feature_name')) {  // Check capability
  // Use enhanced feature
}
const value = api.getServerFeature('config_name', defaultValue)  // Get config
```

**Documentation:**
- Settings system: `docs/SETTINGS.md`
- Feature flags system: `docs/FEATURE_FLAGS.md`

## Common Pitfalls

- NEVER use `any` type - use proper TypeScript types
- NEVER use `as any` type assertions - fix the underlying type issue
- NEVER use `--no-verify` flag when committing
- NEVER delete or disable tests to make them pass
- NEVER circumvent quality checks
- NEVER use `dark:` or `dark-theme:` tailwind variants. Instead use a semantic value from the `style.css` theme, e.g. `bg-node-component-surface`
- NEVER use `:class="[]"` to merge class names - always use `import { cn } from '@/utils/tailwindUtil'`, for example: `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`
