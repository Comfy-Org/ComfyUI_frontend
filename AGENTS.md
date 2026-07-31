# Repository Guidelines

See @docs/guidance/\*.md for file-type-specific conventions (auto-loaded by glob):

- `docs/guidance/engineering.md` — general engineering guidelines, project philosophy, code-review checklist, external resource links
- `docs/guidance/vue-components.md` — Vue 3 Composition API best practices
- `docs/guidance/typescript.md` — TypeScript type-safety rules
- `docs/guidance/vitest.md` — Vitest unit/component test conventions
- `docs/guidance/playwright.md` — Playwright E2E conventions and API-mock typing table
- `docs/guidance/storybook.md` — Storybook story patterns
- `docs/guidance/design-standards.md` — Figma design-standards references

## Project Structure & Module Organization

- Source: `src/`
  - Vue 3.5+, TypeScript, Tailwind 4
  - Key areas: `components/`, `views/`, `stores/` (Pinia), `composables/`, `services/`, `utils/`, `assets/`, `locales/`
- Routing: `src/router.ts`; i18n: `src/i18n.ts`; Entry point: `src/main.ts`
- Tests: unit/component `src/**/*.test.ts`; E2E (Playwright) `browser_tests/**/*.spec.ts`
- Public assets: `public/`
- Build output: `dist/`
- Configs: `vite.config.mts`, `playwright.config.ts`, `eslint.config.ts`, `.oxfmtrc.json`, `.oxlintrc.json`, etc.

## Monorepo Architecture

The project uses **pnpm workspaces** for monorepo organization.

## Package Manager

This project uses **pnpm**. Always prefer scripts defined in `package.json` (e.g., `pnpm test:unit`, `pnpm lint`). To run arbitrary packages not in scripts, use `pnpx` or `pnpm dlx` — never `npx`.

## Build, Test, and Development Commands

- `pnpm dev`: Start Vite dev server.
- `pnpm dev:cloud`: Dev server connected to cloud backend (testcloud.comfy.org)
- `pnpm dev:electron`: Dev server with Electron API mocks
- `pnpm build`: Type-check then production build to `dist/`
- `pnpm preview`: Preview the production build locally
- `pnpm test:unit`: Run Vitest unit tests
- `pnpm test:browser:local`: Run Playwright E2E tests (`browser_tests/`)
- `pnpm lint` / `pnpm lint:fix`: Lint (ESLint)
- `pnpm format` / `pnpm format:check`: oxfmt
- `pnpm typecheck`: Vue TSC type checking
- `pnpm storybook`: Start Storybook development server

## Development Workflow

1. Make code changes
2. Run relevant tests
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm format`
4. Check if README updates are needed
5. Suggest docs.comfy.org updates for user-facing changes

## Git Conventions

- Use `prefix:` format: `feat:`, `fix:`, `test:`
- Add "Fixes #n" to PR descriptions
- Never mention Claude/AI in commits

## Coding Style & Naming Conventions

- Language:
  - TypeScript (exclusive, no new JavaScript)
  - Vue 3 SFCs (Composition API only)
  - Tailwind 4 (avoid `<style>` blocks)
- Style (see `.oxfmtrc.json`): 2-space indent, single quotes, no trailing semicolons, width 80
- Imports: sorted/grouped by plugin, run `pnpm format` before committing; use separate `import type` statements, not inline `type` in mixed imports
  - ✅ `import type { Foo } from './foo'` + `import { bar } from './foo'`
  - ❌ `import { bar, type Foo } from './foo'`
- ESLint: Vue + TS rules, no floating promises, unused imports disallowed, i18n raw-text restrictions in templates
- Naming: Vue components PascalCase (e.g., `MenuHamburger.vue`); composables `useXyz.ts`; Pinia stores `*Store.ts`

## Vue 3 Composition API

- Use `<script setup lang="ts">`; Composition API only
- Use the Vue 3.5 default-prop style — reactive props destructuring, never `withDefaults` or runtime props declaration:

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

- Prefer `defineModel` over a separate prop + emit for v-model bindings
- Define slots via template usage, not `defineSlots`
- Use `provide`/`inject` only when a Store or shared composable wouldn't be simpler
- Prefer, in order: a prop over a `ref`, a `ref` over a `computed`, a `computed` over a `watch`
- See `docs/guidance/vue-components.md` for the full conventions

## Commit & Pull Request Guidelines

- PRs:
  - Include a clear, concise, information-dense description
  - Reference linked issues (e.g. `- Fixes #123`)
  - Don't use emojis or add excessive headers/sections
  - Follow the PR description template in the `.github/` folder
- Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm knip`, relevant tests must pass
- Never use `--no-verify` to bypass failing tests — identify the issue and present root-cause analysis and possible solutions if you can't solve it quickly
- Keep PRs focused and small — if changes look like 300+ lines of non-test code, suggest splitting into multiple PRs

## Security & Configuration Tips

- Secrets: Use `.env` (see `.env_example`); do not commit secrets.

## Development Guidelines

1. Use VueUse for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use vue-i18n (Composition API) for string literals — add entries to `src/locales/en/main.json`; use its plurals system rather than hardcoding pluralization
4. Avoid new usage of PrimeVue components
5. Write tests for all changes, especially bug fixes, to catch regressions
6. Write expressive, self-documenting code and avoid unnecessary comments
7. Before writing new code, ask if there's a simpler way to introduce the same functionality
8. Favor immutability and pure functions over mutable state

See `docs/guidance/engineering.md` for the remaining engineering guidelines.

## Design Standards

Before implementing any user-facing feature, consult the [Comfy Design Standards](https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards) Figma file. Use the Figma MCP to fetch it live — the file is the single source of truth and may be updated by designers at any time.

See `docs/guidance/design-standards.md` for Figma file keys, section node IDs, and component references.

## Testing

- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E)
- Locations: unit/component `src/**/*.test.ts`, E2E `browser_tests/**/*.spec.ts`, litegraph `src/lib/litegraph/test/`
- Do not write change-detector tests, e.g. a test that just asserts that the defaults are certain values
- Do not write tests that are dependent on non-behavioral features like utility classes or styles
- Be parsimonious in testing, do not write redundant tests (see [composable tests](https://tidyfirst.substack.com/p/composable-tests))
- [Don't Mock What You Don't Own](https://hynek.me/articles/what-to-mock-in-5-mins/)
- Conventions: `docs/guidance/vitest.md` (unit/component), `docs/guidance/playwright.md` (E2E), and `docs/testing/*.md` for detailed patterns

## Architecture Decision Records

All architectural decisions are documented in `docs/adr/`. Code changes must be consistent with accepted ADRs; proposed ADRs indicate design direction and should be treated as guidance. See `.agents/checks/adr-compliance.md` for automated validation rules.

### Entity Architecture Constraints (ADR 0003 + ADR 0008)

1. **Command pattern for all mutations**: Every entity state change must be a serializable, idempotent, deterministic command — replayable, undoable, and transmittable over CRDT. No imperative fire-and-forget mutation APIs. Systems produce command batches, not direct side effects.
2. **Dedicated stores over instance state**: Entity data lives in dedicated Pinia stores keyed by string IDs — widget values in `widgetValueStore` keyed by `WidgetId` (`graphId:nodeId:name`, see `src/types/widgetId.ts`), plus `domWidgetStore`, `layoutStore`, `nodeOutputStore`, `subgraphNavigationStore`, and `previewExposureStore`. Prefer a focused store to a single unified registry. Do not add new instance properties/methods to entity classes for data that belongs in a store. Do not use OOP inheritance for entity modeling.
3. **No god-object growth**: Do not add methods to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. Extract to systems, stores, or composables.
4. **Plain data components**: ECS components are plain data objects — no methods, no back-references to parent entities. Behavior belongs in systems (pure functions).
5. **Extension ecosystem impact**: Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets` access, `node.serialize`, or `graph._version++` affect 40+ custom node repos and require migration guidance.

## Common Pitfalls

- NEVER use `any` or `as any` — fix the underlying type issue instead
- NEVER use `--no-verify`, delete/disable tests to make them pass, or otherwise circumvent quality checks
- NEVER add multi-line block comments to justify trivial code changes (a one-line fix, a guard clause mirroring another file, a test-setup line paraphrasing the next line) — if the diff is small and obvious, the comment is noise; write the code and move on
  - **Penance protocol if you catch yourself adding one of these anyway**: stop, acknowledge the comment adds nothing the code doesn't already say, and delete it entirely — don't negotiate or "tighten" it
  - Then open your next response with the exact phrase `Mea culpa: I added a comment that did not earn its keep.` followed by the file path and the deleted text, verbatim, in a fenced block
  - For the rest of that response, add no new comments anywhere — if one is genuinely required, defer the change and ask the user first; there is no statute of limitations, so this applies to old offending comments you discover later too
- NEVER use the `dark:` Tailwind variant — use a semantic value from the `style.css` theme instead (e.g. `bg-node-component-surface`)
- NEVER use `:class="[]"` to merge class names — use `cn()` from `@comfyorg/tailwind-utils` instead (e.g. `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`), inline in the template when feasible
- NEVER use `!important` or the `!` Tailwind prefix — find and fix the interfering `!important` class instead
- NEVER use arbitrary percentage values (`w-[80%]`) when a Tailwind fraction utility exists (`w-4/5`, `w-1/2`, etc.)
- NEVER size iconify `icon-[...]` icons with font-size classes (`text-xs`, etc.) — they size via `width`/`height: 1.2em`; use `size-*` classes, or set font-size on the parent container

## Agent-only rules

Rules for agent-based coding tasks.

### Chrome DevTools MCP

When using `take_snapshot` to inspect dropdowns, listboxes, or other components with dynamic options:

- Use `verbose: true` to see the full accessibility tree including list items
- Non-verbose snapshots often omit nested options in comboboxes/listboxes

### Temporary Files

- Put planning documents under `/temp/plans/`
- Put scripts used under `/temp/scripts/`
- Put summaries of work performed under `/temp/summaries/`
- Put TODOs and status updates under `/temp/in_progress/`
