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

## Design Standards

Before implementing any user-facing feature, consult the [Comfy Design Standards](https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards) Figma file. Use the Figma MCP to fetch it live — the file is the single source of truth and may be updated by designers at any time.

See `docs/guidance/design-standards.md` for Figma file keys, section node IDs, and component references.

## Testing

- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Locations: unit/component `src/**/*.test.ts`, E2E `browser_tests/**/*.spec.ts`, litegraph `src/lib/litegraph/test/`.
- Write tests for all changes, especially bug fixes to catch future regressions.
- Conventions: `docs/guidance/vitest.md` (unit/component), `docs/guidance/playwright.md` (E2E), and `docs/testing/*.md` for detailed patterns.

## Architecture Decision Records

All architectural decisions are documented in `docs/adr/`. Code changes must be consistent with accepted ADRs. Proposed ADRs indicate design direction and should be treated as guidance. See `.agents/checks/adr-compliance.md` for automated validation rules.

### Entity Architecture Constraints (ADR 0003 + ADR 0008)

1. **Command pattern for all mutations**: Every entity state change must be a serializable, idempotent, deterministic command — replayable, undoable, and transmittable over CRDT. No imperative fire-and-forget mutation APIs. Systems produce command batches, not direct side effects.
2. **Centralized registries and ECS-style access**: Entity data lives in the World (centralized registry), queried via `world.getComponent(entityId, ComponentType)`. Do not add new instance properties/methods to entity classes. Do not use OOP inheritance for entity modeling.
3. **No god-object growth**: Do not add methods to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. Extract to systems, stores, or composables.
4. **Plain data components**: ECS components are plain data objects — no methods, no back-references to parent entities. Behavior belongs in systems (pure functions).
5. **Extension ecosystem impact**: Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets` access, `node.serialize`, or `graph._version++` affect 40+ custom node repos and require migration guidance.

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
