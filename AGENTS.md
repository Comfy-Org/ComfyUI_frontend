# Repository Guidelines

See @docs/guidance/\*.md for file-type-specific conventions (auto-loaded by glob):

- `docs/guidance/engineering.md` — general engineering guidelines, project philosophy, code-review checklist, external resource links
- `docs/guidance/vue-components.md` — Vue 3 Composition API best practices
- `docs/guidance/state-and-effects.md` — modelling a feature's state: one discriminated union, named events, a pure transition, effects reserved for synchronising outward
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
- `pnpm comfy-test record`: Interactive test recorder (guided setup for non-devs; **needs a real terminal** — exits immediately with guidance if stdin isn't a TTY)
- `pnpm comfy-test plan --description "<what to test>" [--tags a,b] [--workflow w] [--name n] [--feature-flags name:value,...]`: **Agent entry point.** Non-interactive, no terminal, no backend/dev-server required — reads the filesystem and prints text only. Validates the tags/workflow and prints a `<test-suite>/<test-name>/<test-file>/<seed-file>/<tag>/<body>` block ready to hand to the `playwright-test-generator` agent below — this is how an agent (not a human) produces a test with `comfy-test`. Example:
  ```
  pnpm comfy-test plan --description "collapsing a KSampler node keeps its connections" --tags @canvas,@widget
  ```
- `pnpm comfy-test transform <file> [--name <n>] [--tags <a,b>] [--workflow <w>] [--output <f>] [--feature-flags <specs>]`: Transform raw Playwright codegen to conventions. Non-interactive.
- `pnpm comfy-test pr <file> [description]`: Open a pull request for a generated test. Non-interactive.
- `pnpm comfy-test check [--distribution cloud|cloud-staging|cloud-prod|local] [--backend <url>]`: Check environment prerequisites
- `pnpm comfy-test list [--filter <keyword>]`: List available test workflows
- `pnpm comfy-test tags`: List test tags with their meanings
- `pnpm comfy-test add-workflow <file> [--name <n>]`: Add and validate a workflow asset from disk

**Agent workflow, end to end:** `comfy-test plan` → hand its output to the `playwright-test-generator` agent (writes a convention-compliant spec directly, no `transform` needed) → `comfy-test pr <file>`.

**A `[WARN] Unsupported engine` line on every `comfy-test` invocation is not a failure** — pnpm warns when the local Node version doesn't match `package.json`'s `engines` field, but the command still runs and exits 0 on success. Don't treat it as a tool failure requiring investigation.

### Playwright Test Agents (`.claude/agents/`)

| Agent                          | Responsibility                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `playwright-test-planner.md`   | Explores the app, identifies testable scenarios, creates structured test plans                                                    |
| `playwright-test-generator.md` | Generates Playwright test code from plans using ComfyUI fixtures and conventions — this is what `comfy-test plan`'s output is for |
| `playwright-test-healer.md`    | Diagnoses and fixes failing tests; escalates regressions rather than auto-skipping                                                |

Guardrails: agents must use `comfyPage` fixture (not bare `page`), never add `waitForTimeout()`, never weaken assertions, and reference `.claude/skills/codegen-transform/SKILL.md` for transform rules.

- `pnpm lint` / `pnpm lint:fix`: Lint (ESLint)
- `pnpm format` / `pnpm format:check`: oxfmt
- `pnpm typecheck`: Vue TSC type checking
- `pnpm storybook`: Start Storybook development server

> **`vue-tsc` needs its own `node_modules` in the checkout.** `vue-tsc --noEmit`
> (what `pnpm typecheck` runs) emits type references as relative paths into
> pnpm's `.pnpm/` store, computed from where that store actually lives. A normal
> pnpm install is heavily symlinked and works fine — but a `node_modules`
> borrowed from another directory (symlinked or copied from a sibling checkout)
> sits at a different depth, so every emitted path overshoots and vue-tsc
> reports ~1300 phantom `TS2688` errors against `.vue` files unrelated to your
> diff. Run `pnpm install` in the checkout before trusting `pnpm typecheck`.
> Vitest is unaffected: it resolves through Vite, not these emitted paths.

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
4. PrimeVue has been removed. Its imports are permanently banned; use components from `src/components/ui`.
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

When working from a TDD or design doc, record its tradeoffs, alternatives considered, and rejected options as a new ADR, keeping only the context a future maintainer cannot read off the code, and follow the ADR structure and update the index per `docs/adr/README.md`.

### Entity Architecture Constraints (ADR 0003 + ADR 0008)

1. **Command pattern for all mutations**: Every entity state change must be a serializable, idempotent, deterministic command — replayable, undoable, and transmittable over CRDT. No imperative fire-and-forget mutation APIs. Systems produce command batches, not direct side effects.
2. **Dedicated stores over instance state**: Entity data lives in dedicated Pinia stores keyed by each concern's established ID type. Most entity IDs are branded numbers; node IDs may be numbers or strings, graph IDs are UUID strings, and scoped concerns may use composite string keys such as `WidgetId` (`graphId:nodeId:name`, see `src/types/widgetId.ts`). Prefer a focused store to a single unified registry. Do not add new instance properties/methods to entity classes for data that belongs in a store. Do not use OOP inheritance for entity modeling.
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
- NEVER call `captureException` or `datadogRum.addError` directly
  - Use `reportError()` from `@/platform/telemetry/reportError`; see `src/AGENTS.md`
  - Each raw sink reaches one console, so the failure reads as zero in the other
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

### PR Review Comment Resolution

**Never resolve review comments on PRs where you are the author.**

Per the team's [PR guidelines](CONTRIBUTING.md#comment-resolution),
resolving comments is the reviewer's prerogative. As author, you may only
resolve:

- Automated review comments (Coderabbit, Claude, etc.)
- Trivial single-interpretation comments (e.g. fixing a typo exactly as
  suggested)
- Comments addressed via GitHub's "Apply suggestion" feature used as-is

For all other comments: reply in the thread explaining what you changed
(or why you disagree), then re-assign the PR to the reviewer.
**Do not click Resolve.**

### Chrome DevTools MCP

When using `take_snapshot` to inspect dropdowns, listboxes, or other components with dynamic options:

- Use `verbose: true` to see the full accessibility tree including list items
- Non-verbose snapshots often omit nested options in comboboxes/listboxes

### Temporary Files

- Put planning documents under `/temp/plans/`
- Put scripts used under `/temp/scripts/`
- Put summaries of work performed under `/temp/summaries/`
- Put TODOs and status updates under `/temp/in_progress/`
