# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/`
  - Vue 3.5+
  - TypeScript
  - Tailwind 4
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
- Entry Point: `src/main.ts`.
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

The project uses **Nx** for build orchestration and task management

## Build, Test, and Development Commands

- `pnpm dev`: Start Vite dev server.
- `pnpm dev:electron`: Dev server with Electron API mocks
- `pnpm build`: Type-check then production build to `dist/`
- `pnpm preview`: Preview the production build locally
- `pnpm test:unit`: Run Vitest unit tests
- `pnpm test:browser`: Run Playwright E2E tests (`browser_tests/`)
- `pnpm lint` / `pnpm lint:fix`: Lint (ESLint)
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm typecheck`: Vue TSC type checking

## Coding Style & Naming Conventions

- Language:
  - TypeScript (exclusive, no new JavaScript)
  - Vue 3 SFCs (`.vue`)
    - Composition API only
  - Tailwind 4 styling
    - Avoid `<style>` blocks
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

- Frameworks:
  - Vitest (unit/component, happy-dom)
  - Playwright (E2E)
- Test files:
  - Unit/Component: `**/*.test.ts`
  - E2E: `browser_tests/**/*.spec.ts`
  - Litegraph Specific: `src/lib/litegraph/test/`
- Coverage: text/json/html reporters enabled
  - aim to cover critical logic and new features
- Playwright:
  - optional tags like `@mobile`, `@2x` are respected by config
- Tests to avoid
  - Change detector tests
    - e.g. a test that just asserts that the defaults are certain values
  - Tests that are dependent on non-behavioral features like utility classes or styles
  - Redundant tests

## Commit & Pull Request Guidelines

- PRs:
  - Include clear description
  - Reference linked issues (e.g. `- Fixes #123`)
  - Keep it extremely concise and information-dense
  - Don't use emojis or add excessive headers/sections
  - Follow the PR description template in the `.github/` folder.
- Quality gates:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm knip`
  - Relevant tests must pass
- Never use `--no-verify` to bypass failing tests
  - Identify the issue and present root cause analysis and possible solutions if you are unable to solve quickly yourself
- Keep PRs focused and small
  - If it looks like the current changes will have 300+ lines of non-test code, suggest ways it could be broken into multiple PRs

## Security & Configuration Tips

- Secrets: Use `.env` (see `.env_example`); do not commit secrets.

## Vue 3 Composition API Best Practices

- Use `<script setup lang="ts">` for component logic
- Utilize `ref` for reactive state
- Implement computed properties with computed()
- Use watch and watchEffect for side effects
  - Avoid using a `ref` and a `watch` if a `computed` would work instead
- Implement lifecycle hooks with onMounted, onUpdated, etc.
- Utilize provide/inject for dependency injection
  - Do not use dependency injection if a Store or a shared composable would be simpler
- Use Vue 3.5 TypeScript style of default prop declaration
  - Example:

    ```typescript
    const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
    }>()
    ```

  - Prefer reactive props destructuring to `const props = defineProps<...>`
  - Do not use `withDefaults` or runtime props declaration
  - Do not import Vue macros unnecessarily
  - Prefer `useModel` to separately defining a prop and emit
  - Be judicious with addition of new refs or other state
    - If it's possible to accomplish the design goals with just a prop, don't add a `ref`
    - If it's possible to use the `ref` or prop directly, don't add a `computed`
    - If it's possible to use a `computed` to name and reuse a derived value, don't use a `watch`

## Development Guidelines

1. Leverage VueUse functions for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use TypeScript for type safety
4. If a complex type definition is inlined in multiple related places, extract and name it for reuse
5. In Vue Components, implement proper props and emits definitions
6. Utilize Vue 3's Teleport component when needed
7. Use Suspense for async components
8. Implement proper error handling
9. Follow Vue 3 style guide and naming conventions
10. Use Vite for fast development and building
11. Use vue-i18n in composition API for any string literals. Place new translation entries in src/locales/en/main.json
12. Avoid new usage of PrimeVue components
13. Write tests for all changes, especially bug fixes to catch future regressions
14. Write code that is expressive and self-documenting to the furthest degree possible. This reduces the need for code comments which can get out of sync with the code itself. Try to avoid comments unless absolutely necessary
15. Do not add or retain redundant comments, clean as you go
16. Whenever a new piece of code is written, the author should ask themselves 'is there a simpler way to introduce the same functionality?'. If the answer is yes, the simpler course should be chosen
17. Refactoring should be used to make complex code simpler
18. Try to minimize the surface area (exported values) of each module and composable
19. Don't use barrel files, e.g. `/some/package/index.ts` to re-export within `/src`
20. Keep functions short and functional
21. Minimize nesting, e.g. `if () { ... }` or `for () { ... }`
22. Avoid mutable state, prefer immutability and assignment at point of declaration

## External Resources

- Vue: <https://vuejs.org/api/>
- Tailwind: <https://tailwindcss.com/docs/styling-with-utility-classes>
- VueUse: <https://vueuse.org/functions.html>
- shadcn/vue: <https://www.shadcn-vue.com/>
- Reka UI: <https://reka-ui.com/>
- PrimeVue: <https://primevue.org>
- ComfyUI: <https://docs.comfy.org>
- Electron: <https://www.electronjs.org/docs/latest/>
- Wiki: <https://deepwiki.com/Comfy-Org/ComfyUI_frontend/1-overview>
- Nx: <https://nx.dev/docs/reference/nx-commands>

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

## Common Pitfalls

- NEVER use `any` type - use proper TypeScript types
- NEVER use `as any` type assertions - fix the underlying type issue
- NEVER use `--no-verify` flag when committing
- NEVER delete or disable tests to make them pass
- NEVER circumvent quality checks
- NEVER use the `dark:` tailwind variant
  - Instead use a semantic value from the `style.css` theme
    - e.g. `bg-node-component-surface`
- NEVER use `:class="[]"` to merge class names
  - Always use `import { cn } from '@/utils/tailwindUtil'`
    - e.g. `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`
  - Use `cn()` inline in the template when feasible instead of creating a `computed` to hold the value
