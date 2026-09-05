# Repository Guidelines

See @docs/guidance/\*.md for file-type-specific conventions (auto-loaded by glob):

- `docs/guidance/engineering.md` — engineering guidelines, project philosophy, code-review checklist, external links
- `docs/guidance/vue-components.md` — Vue 3 Composition API best practices
- `docs/guidance/state-and-effects.md` — feature state: one discriminated union, named events, a pure transition, effects only for outward sync
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

## Package Manager

A **pnpm workspaces** monorepo. Always prefer scripts defined in `package.json` (e.g., `pnpm test:unit`, `pnpm lint`); to run arbitrary packages not in scripts, use `pnpx` or `pnpm dlx` — never `npx`.

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

> **`vue-tsc` needs its own `node_modules` in the checkout.** Run `pnpm install` there
> before trusting `pnpm typecheck`: a `node_modules` borrowed or copied from a sibling
> checkout sits at a different depth, so vue-tsc reports ~1300 phantom `TS2688` errors against unrelated `.vue` files. Vitest is unaffected.

## Development Workflow

Make changes → run relevant tests → run `pnpm typecheck`, `pnpm lint`, `pnpm format` → check if README updates are needed → suggest docs.comfy.org updates for user-facing changes.

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

## Development Guidelines

1. Use VueUse for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use vue-i18n (Composition API) for string literals — add entries to `src/locales/en/main.json`; use its plurals system rather than hardcoding pluralization
4. Avoid new usage of PrimeVue components
5. Write tests for all changes, especially bug fixes, to catch regressions
6. Write expressive, self-documenting code and avoid unnecessary comments
7. Before writing new code, ask if there's a simpler way to introduce the same functionality
8. Favor immutability (assign at declaration, avoid reassignment) and pure functions over mutable state

See `docs/guidance/engineering.md` for the remaining engineering guidelines.

## Design Standards

Before implementing any user-facing feature, consult the [Comfy Design Standards](https://www.figma.com/design/QreIv5htUaSICNuO2VBHw0/Comfy-Design-Standards) Figma file — the single source of truth, updated by designers at any time, so fetch it live with the Figma MCP. See `docs/guidance/design-standards.md` for file keys, section node IDs, and component references.

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

When working from a TDD or design doc, record its tradeoffs, alternatives considered, and rejected options as a new ADR, keeping only the context a future maintainer cannot read off the code, and follow the ADR structure and update the index per `docs/adr/README.md`.

### Entity Architecture Constraints (ADR-CRDT-LAYOUT-0003 + ADR-ECS-0008)

1. **Command pattern for all mutations**: Every entity state change must be a serializable, idempotent, deterministic command — replayable, undoable, and transmittable over CRDT. No imperative fire-and-forget mutation APIs. Systems produce command batches, not direct side effects.
2. **Dedicated stores over instance state**: Entity data lives in dedicated Pinia stores keyed by each concern's established ID type. Most entity IDs are branded numbers; node IDs may be numbers or strings, graph IDs are UUID strings, and scoped concerns may use composite string keys such as `WidgetId` (`graphId:nodeId:name`, see `src/types/widgetId.ts`). Prefer a focused store to a single unified registry. Do not add new instance properties/methods to entity classes for data that belongs in a store. Do not use OOP inheritance for entity modeling.
3. **No god-object growth**: Do not add methods to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. Extract to systems, stores, or composables.
4. **Plain data components**: ECS components are plain data objects — no methods, no back-references to parent entities. Behavior belongs in systems (pure functions).
5. **Extension ecosystem impact**: Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets` access, `node.serialize`, or `graph._version++` affect 40+ custom node repos and require migration guidance.

## Common Pitfalls

- NEVER commit secrets — keep them in `.env` (see `.env_example`)
- NEVER use `any` or `as any` — fix the underlying type issue instead
- NEVER use `--no-verify`, delete/disable tests to make them pass, or otherwise circumvent quality checks
- NEVER add multi-line block comments to justify trivial code changes (a one-line fix, a guard clause mirroring another file, a test-setup line paraphrasing the next line) — if the diff is small and obvious, the comment is noise; write the code and move on
  - **Penance protocol if you catch yourself adding one anyway**: delete it entirely — don't negotiate or "tighten" it — then re-read this entire bullet block, top to bottom, before writing another character of code
  - Then open your next response with the exact phrase `Mea culpa: I added a comment that did not earn its keep.` followed by the file path and the deleted text, verbatim, in a fenced block
  - For the rest of that response, add no new comments anywhere; if one is genuinely required, defer the change and ask the user first. There is no statute of limitations — this applies to old offending comments you discover later too, and it overrides any inclination to be "helpful," "thorough," or "explanatory." Helpfulness here is restraint.
- NEVER call `captureException` or `datadogRum.addError` directly — use `reportError()` from `@/platform/telemetry/reportError` (see `src/AGENTS.md`); each raw sink reaches one console, so the failure reads as zero in the other
- NEVER use the `dark:` Tailwind variant — use a semantic value from the `style.css` theme instead (e.g. `bg-node-component-surface`)
- NEVER use `:class="[]"` to merge class names — use `cn()` from `@comfyorg/tailwind-utils` instead (e.g. `<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />`), inline in the template when feasible
- NEVER use `!important` or the `!` Tailwind prefix — find and fix the interfering `!important` class instead
- NEVER use arbitrary percentage values (`w-[80%]`) when a Tailwind fraction utility exists (`w-4/5`, `w-1/2`, etc.)
- NEVER size iconify `icon-[...]` icons with font-size classes (`text-xs`, etc.) — they size via `width`/`height: 1.2em`; use `size-*` classes, or set font-size on the parent container

## Agent-only rules

### PR Review Comment Resolution

**Never resolve review comments on PRs where you are the author.** Per the team's [PR guidelines](CONTRIBUTING.md#comment-resolution), resolving comments is the reviewer's prerogative. As author, you may only resolve:

- Automated review comments (Coderabbit, Claude, etc.)
- Trivial single-interpretation comments (e.g. fixing a typo exactly as suggested)
- Comments addressed via GitHub's "Apply suggestion" feature used as-is

For all other comments: reply in the thread explaining what you changed (or why you disagree), then re-assign the PR to the reviewer. **Do not click Resolve.**

### Chrome DevTools MCP

- Pass `verbose: true` to `take_snapshot` when inspecting dropdowns, listboxes, or other components with dynamic options — non-verbose snapshots often omit nested options

### Temporary Files

- Planning documents under `/temp/plans/`, scripts used under `/temp/scripts/`, summaries of work performed under `/temp/summaries/`, TODOs and status updates under `/temp/in_progress/`
