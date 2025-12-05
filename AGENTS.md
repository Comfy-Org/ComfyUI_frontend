# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/`
  - Vue 3.5+
  - TypeScript
  - Key areas:
    - `components/`
    - `views/`
    - `stores/` (Pinia)
    - `composables/`
    - `services/`
    - `utils/`
    - `assets/`
    - `locales/`
- Routing: `src/router.ts`,
- i18n: `src/i18n.ts`,
- Entry Point:`src/main.ts`.
- Tests:
  - unit/component in `tests-ui/` and `src/**/*.test.ts`
  - E2E (Playwright) in `browser_tests/**/*.spec.ts`
- Public assets: `public/`
- Build output: `dist/`
- Configs
  - `vite.config.mts`
  - `vitest.config.ts`
  - `playwright.config.ts`
  - `eslint.config.ts`
  - `.prettierrc`
  - etc.

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

## Build, Test, and Development Commands

- `pnpm dev`: Start Vite dev server.
- `pnpm dev:electron`: Dev server with Electron API mocks.
- `pnpm build`: Type-check then production build to `dist/`.
- `pnpm preview`: Preview the production build locally.
- `pnpm test:unit`: Run Vitest unit tests.
- `pnpm test:browser`: Run Playwright E2E tests (`browser_tests/`).
- `pnpm lint` / `pnpm lint:fix`: Lint (ESLint). `pnpm format` / `format:check`: Prettier.
- `pnpm typecheck`: Vue TSC type checking.

## Coding Style & Naming Conventions

- Language:
  - TypeScript (exclusive, no new JavaScript)
  - Vue SFCs (`.vue`)
- Style: (see `.prettierrc`)
  - Indent 2 spaces
  - single quotes
  - no trailing semicolons
  - width 80
- Imports:
  - sorted/grouped by plugin
  - run `pnpm format` before committing
- ESLint:
  - Vue + TS rules
  - no floating promises
  - unused imports disallowed
  - i18n raw text restrictions in templates
- Naming:
  - Vue components in PascalCase (e.g., `MenuHamburger.vue`)
  - composables `useXyz.ts`
  - Pinia stores `*Store.ts`

## Testing Guidelines

- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Test files: `**/*.{test,spec}.{ts,tsx,js}` under `tests-ui/`, `src/components/`, and `src/lib/litegraph/test/`.
- Coverage: text/json/html reporters enabled; aim to cover critical logic and new features.
- Playwright: place tests in `browser_tests/`; optional tags like `@mobile`, `@2x` are respected by config.

## Commit & Pull Request Guidelines

- Commits: Use `[skip ci]` for locale-only updates when appropriate.
- PRs: Include clear description, linked issues (`- Fixes #123`), and screenshots/GIFs for UI changes.
- Quality gates: `pnpm lint`, `pnpm typecheck`, and relevant tests must pass. Keep PRs focused and small.

## Security & Configuration Tips

- Secrets: Use `.env` (see `.env_example`); do not commit secrets.

## Vue 3 Composition API Best Practices

- Use setup() function for component logic
- Utilize ref and reactive for reactive state
- Implement computed properties with computed()
- Use watch and watchEffect for side effects
- Implement lifecycle hooks with onMounted, onUpdated, etc.
- Utilize provide/inject for dependency injection
- Use vue 3.5 style of default prop declaration. Example:

```typescript
const { nodes, showTotal = true } = defineProps<{
  nodes: ApiNodeCost[]
  showTotal?: boolean
}>()
```

## Development Guidelines

1. Leverage VueUse functions for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use TypeScript for type safety
4. Implement proper props and emits definitions
5. Utilize Vue 3's Teleport component when needed
6. Use Suspense for async components
7. Implement proper error handling
8. Follow Vue 3 style guide and naming conventions
9. Use Vite for fast development and building
10. Use vue-i18n in composition API for any string literals. Place new translation entries in src/locales/en/main.json
11. Never use deprecated PrimeVue components listed above

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
