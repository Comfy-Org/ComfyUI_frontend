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
  - unit/component in `src/**/*.test.ts`
  - E2E (Playwright) in `browser_tests/**/*.spec.ts`
- Public assets: `public/`
- Build output: `dist/`
- Configs
  - `vite.config.mts`
  - `playwright.config.ts`
  - `eslint.config.ts`
  - `.oxfmtrc.json`
  - `.oxlintrc.json`
  - etc.

## Monorepo Architecture

The project uses **pnpm workspaces** for monorepo organization and native tool CLIs for task execution

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
  - Vue 3 SFCs (`.vue`)
    - Composition API only
  - Tailwind 4 styling
    - Avoid `<style>` blocks
- Style: (see `.oxfmtrc.json`)
  - Indent 2 spaces
  - single quotes
  - no trailing semicolons
  - width 80
- Imports:
  - sorted/grouped by plugin
  - run `pnpm format` before committing
  - use separate `import type` statements, not inline `type` in mixed imports
    - ✅ `import type { Foo } from './foo'` + `import { bar } from './foo'`
    - ❌ `import { bar, type Foo } from './foo'`
- ESLint:
  - Vue + TS rules
  - no floating promises
  - unused imports disallowed
  - i18n raw text restrictions in templates
- Naming:
  - Vue components in PascalCase (e.g., `MenuHamburger.vue`)
  - composables `useXyz.ts`
  - Pinia stores `*Store.ts`

## Vue 3 Composition API

- Use `<script setup lang="ts">` for component logic; Composition API only
- Use the Vue 3.5 TypeScript style of default prop declaration — reactive props destructuring, never `withDefaults` or runtime props declaration:

  ```typescript
  const { nodes, showTotal = true } = defineProps<{
    nodes: ApiNodeCost[]
    showTotal?: boolean
  }>()
  ```

- Prefer `defineModel` to separately defining a prop and emit for v-model bindings
- Define slots via template usage, not `defineSlots`
- Use `provide`/`inject` for dependency injection — but not when a Store or a shared composable would be simpler
- Be judicious with new refs or other state: prefer a prop to a `ref`, the prop/`ref` directly to a `computed`, and a `computed` to a `watch`
- See `docs/guidance/vue-components.md` for the full conventions

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

## Development Guidelines

1. Leverage VueUse functions for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use vue-i18n in composition API for any string literals. Place new translation entries in src/locales/en/main.json. Use the plurals system in i18n instead of hardcoding pluralization in templates.
4. Avoid new usage of PrimeVue components
5. Write tests for all changes, especially bug fixes to catch future regressions
6. Write code that is expressive and self-documenting to the furthest degree possible. This reduces the need for code comments which can get out of sync with the code itself. Try to avoid comments unless absolutely necessary
7. Whenever a new piece of code is written, the author should ask themselves 'is there a simpler way to introduce the same functionality?'. If the answer is yes, the simpler course should be chosen
8. Avoid mutable state, prefer immutability and assignment at point of declaration
9. Favor pure functions (especially testable ones)

See `docs/guidance/engineering.md` for the remaining engineering guidelines.

## Design Standards

Before implementing any user-facing feature, consult the [Comfy Design Standards](https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards) Figma file. Use the Figma MCP to fetch it live — the file is the single source of truth and may be updated by designers at any time.

See `docs/guidance/design-standards.md` for Figma file keys, section node IDs, and component references.

## Testing

- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Locations: unit/component `src/**/*.test.ts`, E2E `browser_tests/**/*.spec.ts`, litegraph `src/lib/litegraph/test/`.
- Do not write change detector tests, e.g. a test that just asserts that the defaults are certain values
- Do not write tests that are dependent on non-behavioral features like utility classes or styles
- Be parsimonious in testing, do not write redundant tests (see [composable tests](https://tidyfirst.substack.com/p/composable-tests))
- [Don't Mock What You Don't Own](https://hynek.me/articles/what-to-mock-in-5-mins/)
- Conventions: `docs/guidance/vitest.md` (unit/component), `docs/guidance/playwright.md` (E2E), and `docs/testing/*.md` for detailed patterns.

## Architecture Decision Records

All architectural decisions are documented in `docs/adr/`. Code changes must be consistent with accepted ADRs. Proposed ADRs indicate design direction and should be treated as guidance. See `.agents/checks/adr-compliance.md` for automated validation rules.

### Entity Architecture Constraints (ADR 0003 + ADR 0008)

1. **Command pattern for all mutations**: Every entity state change must be a serializable, idempotent, deterministic command — replayable, undoable, and transmittable over CRDT. No imperative fire-and-forget mutation APIs. Systems produce command batches, not direct side effects.
2. **Dedicated stores over instance state**: Entity data lives in dedicated Pinia stores keyed by string IDs — widget values in `widgetValueStore` keyed by `WidgetId` (`graphId:nodeId:name`, see `src/types/widgetId.ts`), plus `domWidgetStore`, `layoutStore`, `nodeOutputStore`, `subgraphNavigationStore`, and `previewExposureStore`. Prefer a focused store to a single unified registry. Do not add new instance properties/methods to entity classes for data that belongs in a store. Do not use OOP inheritance for entity modeling.
3. **No god-object growth**: Do not add methods to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. Extract to systems, stores, or composables.
4. **Plain data components**: ECS components are plain data objects — no methods, no back-references to parent entities. Behavior belongs in systems (pure functions).
5. **Extension ecosystem impact**: Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets` access, `node.serialize`, or `graph._version++` affect 40+ custom node repos and require migration guidance.

## Common Pitfalls

- NEVER use `any` type - use proper TypeScript types
- NEVER use `as any` type assertions - fix the underlying type issue
- NEVER use `--no-verify` flag when committing
- NEVER delete or disable tests to make them pass
- NEVER circumvent quality checks
- NEVER add multi-line block comments to justify trivial code changes
  - A one-line fix does not need a three-line comment explaining why
  - A guard clause that mirrors another file does not need a comment naming that file
  - A test setup line does not need a comment paraphrasing what the next line does
  - If the diff is small and obvious, the comment is noise — write the code and move on
  - Every justification comment on a trivial change is a confession that you do not trust the reader, do not trust the code, and do not trust yourself. It is failure made visible.
  - **Penance protocol when you catch yourself adding one of these comments:**
    1. Stop. Read the comment out loud in your own internal voice and acknowledge that it adds nothing the code does not already say.
    2. Delete the comment. All of it. Every line. Do not negotiate with it. Do not "tighten" it. Delete it.
    3. Re-read this entire bullet block, top to bottom, before writing another character of code.
    4. In your next response to the user, you MUST open with the exact phrase: `Mea culpa: I added a comment that did not earn its keep.` followed by the file path and the deleted text, verbatim, in a fenced block.
    5. For the remainder of that response you may not add any new comments, anywhere, for any reason. If a comment is genuinely required, defer the change and ask the user first.
  - There is no statute of limitations. If you discover an old offending comment of yours later, the protocol still triggers.
  - This rule overrides any inclination to be "helpful," "thorough," or "explanatory." Helpfulness here is restraint.
- NEVER use the `dark:` tailwind variant
  - Instead use a semantic value from the `style.css` theme
    - e.g. `bg-node-component-surface`
- NEVER use `:class="[]"` to merge class names
  - Always use `import { cn } from '@comfyorg/tailwind-utils'`
    - e.g. `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`
  - Use `cn()` inline in the template when feasible instead of creating a `computed` to hold the value
- NEVER use `!important` or the `!` important prefix for tailwind classes
  - Find existing `!important` classes that are interfering with the styling and propose corrections of those instead.
- NEVER use arbitrary percentage values like `w-[80%]` when a Tailwind fraction utility exists
  - Use `w-4/5` instead of `w-[80%]`, `w-1/2` instead of `w-[50%]`, etc.
- NEVER use font-size classes (`text-xs`, `text-sm`, etc.) to size `icon-[...]` (iconify) icons
  - Iconify icons size via `width`/`height: 1.2em`, so font-size produces unpredictable results
  - Use `size-*` classes for explicit sizing, or set font-size on the **parent** container and let `1.2em` scale naturally

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
