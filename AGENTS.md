# Repository Guidelines

File-type conventions in `docs/guidance/*.md` load automatically by the `globs`
in their frontmatter:

- `engineering.md`: repo-specific engineering and review rules
- `vue-components.md`: props, models, slots, state, and styling in `.vue` files
- `state-and-effects.md`: one discriminated union, named events, a pure transition, effects only for outward sync
- `error-handling.md`: failure as data, validate before mutation, report once at the ownership boundary
- `typescript.md`: assertions, generated API types, circular dependencies, API helpers
- `testing-principles.md`: test design rules at every level
- `vitest.md`: Vitest unit/component test conventions
- `playwright.md`: Playwright E2E conventions
- `storybook.md`: Storybook story patterns
- `design-standards.md`: Figma design-standards references
- `performance-incident-runbook.md`: staged evidence gathering for frame drops, input latency, long tasks, and unexpected redraws

## Project Structure

- pnpm workspaces monorepo. The app is in `src/` (Vue 3.5+, TypeScript, Tailwind 4, Pinia); shared code is in `packages/`, other apps in `apps/`, repo tooling in `tools/` and `scripts/`.
- Use Vite for frontend package bundling with TypeScript `moduleResolution: "bundler"`. Fix package exports and source imports; do not patch compiler or resolver dependencies to make package builds pass.
- Entry `src/main.ts`, routing `src/router.ts`, i18n `src/i18n.ts`.
- Tests: unit/component `src/**/*.test.ts`, E2E `browser_tests/**/*.spec.ts`, litegraph `src/lib/litegraph/test/`.

## Commands

Prefer scripts in `package.json`. To run other packages, use `pnpx` or `pnpm dlx`, never `npx`.

- `pnpm dev`: Vite dev server; `pnpm dev:cloud` against testcloud.comfy.org; `pnpm dev:electron` with Electron API mocks
- `pnpm test:unit path/to/file`: Vitest
- `pnpm test:browser:local`: Playwright E2E against ComfyUI on 8188 and `pnpm dev:test` on 5173 (see Agent-only rules)
- `pnpm comfy-test`: test recorder and agent test-generation workflow; see `tools/test-recorder/README.md`
- `pnpm lint:unstaged:fix`: lint what you changed
- `pnpm format`: oxfmt
- `pnpm deps:audit`: reject production `src/` import cycles, including type-only imports
- `pnpm audit:inherited-classes [--write]`: report text classes that repeat a value every render context already inherits (manual, not a gate)
- `pnpm storybook`: Storybook dev server

> **`vue-tsc` needs its own `node_modules` in the checkout.** A `node_modules`
> borrowed from another directory (symlinked or copied from a sibling checkout)
> makes `pnpm typecheck` report ~1300 phantom `TS2688` errors against unrelated
> `.vue` files. Run `pnpm install` in the checkout before trusting it. Vitest is
> unaffected.

## Development Workflow

1. Make code changes
2. Run the tests for what you changed: `pnpm test:unit path/to/file`
3. Lint what you changed: `pnpm lint:unstaged:fix`
4. Check if README updates are needed
5. Suggest docs.comfy.org updates for user-facing changes

Do not run repo-wide checks to verify your work: `pnpm lint`, `pnpm typecheck`,
`pnpm knip`, `pnpm build`, or `pnpm test:unit` without a path. They load every
core, and chained together they take minutes. The pre-commit hook already
formats, lints, and typechecks what you stage, the pre-push hook runs knip, and
CI runs everything.

## Git and Pull Requests

- Commit messages use `prefix:` format: `feat:`, `fix:`, `test:`. Never mention Claude/AI in commits.
- PR descriptions follow `.github/pull_request_template.md`, reference linked issues (`- Fixes #123`), and stay concise: no emojis, no excess sections.
- Never use `--no-verify`. If a hook or test fails and you cannot fix it quickly, present the root cause and possible solutions.
- Keep PRs focused. If non-test changes will exceed ~300 lines, suggest how to split them.

## Naming

- Vue components in PascalCase (`MenuHamburger.vue`), composables `useXyz.ts`, Pinia stores `*Store.ts`.
- TypeScript only; no new JavaScript.

## Development Guidelines

1. Leverage VueUse functions for performance-enhancing styles
2. Use es-toolkit for utility functions
3. Use vue-i18n in composition API for any string literals. Place new translation entries in `src/locales/en/main.json`. Use the plurals system in i18n instead of hardcoding pluralization in templates.
4. Use components from `@comfyorg/design-system`.
5. Add tests for changed behavioral contracts or reproduced bugs when existing tests do not cover them. Behavior-preserving refactors need no new tests. Follow `docs/guidance/testing-principles.md` before proposing or writing tests.
6. Whenever a new piece of code is written, ask whether there is a simpler way to introduce the same functionality. If there is, choose it.
7. Avoid mutable state, prefer immutability and assignment at point of declaration
8. Favor pure functions (especially testable ones)
9. Before implementing a user-facing feature, consult the Comfy Design Standards Figma file; see `docs/guidance/design-standards.md`.

## Testing

- Frameworks: Vitest (unit/component, happy-dom) and Playwright (E2E).
- Read `docs/guidance/testing-principles.md` before proposing, reviewing, or writing tests, not only when editing a test file. Start with caller or user expectations and reachable scenarios, then choose the smallest suite that protects them.
- Conventions: `docs/guidance/vitest.md` (unit/component), `docs/guidance/playwright.md` (E2E), and `docs/testing/*.md` for detailed patterns.

## Architecture Decision Records

All architectural decisions are documented in `docs/adr/`. Code changes must be consistent with accepted ADRs. Proposed ADRs indicate design direction and should be treated as guidance. See `.agents/checks/adr-compliance.md` for automated validation rules.

When working from a TDD or design doc, record its tradeoffs, alternatives considered, and rejected options as a new ADR, keeping only the context a future maintainer cannot read off the code, and model its structure on an existing ADR in `docs/adr/`.

ADR files are named `<DOMAIN>[-<SUBDOMAIN>]-<NNNN>-descriptive-title.md`: at most two tags ordered broad-to-narrow, the first naming the subsystem that owns the invariant, then the next unused four-digit sequence number. Each ADR opens with `# ADR-<IDENTIFIER>: Title`, a `Date: YYYY-MM-DD` line, and a `## Status` section (`Proposed`, `Accepted`, `Rejected`, `Deprecated`, or `Superseded`). `pnpm adr:check` enforces the filename, heading, date, status, and identifier uniqueness. There is no index file; list the directory to find ADRs.

### Entity Architecture Constraints (ADR-CRDT-LAYOUT-0003 + ADR-ECS-0008)

1. **Command pattern for durable layout mutations**: Persistent node, group, and reroute geometry changes must flow through serializable `LayoutOperation` objects rather than direct property access. Transient renderer measurements remain outside that command stream. Do not generalize layout command coverage to all ECS mutations; non-layout stores currently expose direct actions, and graph operations still coordinate imperative class callbacks.
2. **Dedicated stores over instance state**: Entity data lives in dedicated Pinia stores keyed by each concern's established ID type. Most entity IDs are branded numbers; node IDs may be numbers or strings, graph IDs are UUID strings, and scoped concerns may use composite string keys such as `WidgetId` (`graphId:nodeId:name`, see `packages/graph-model/src/widgetId.ts`). Prefer a focused store to a single unified registry. Do not add new instance properties/methods to entity classes for data that belongs in a store. Do not use OOP inheritance for entity modeling.
3. **No god-object growth**: Do not add methods to `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph`. Extract to systems, stores, or composables.
4. **Plain data components**: ECS components are plain data objects — no methods, no back-references to parent entities. Behavior belongs in systems (pure functions).
5. **Extension ecosystem impact**: Changes to entity callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`, `onConnectInput/Output`, `onConfigure`, `onWidgetChanged`), `node.widgets` access, `node.serialize`, or `graph._version++` affect 40+ custom node repos and require migration guidance.

## Common Pitfalls

- NEVER derive a server fact on the client: a gate renders one fact from the
  API as received, without combining it with role, tier, plan state, seats or
  `isCloud`. Local UI state (loading, in-flight, form validity) may only
  disable the control, never grant it. A missing fact is a backend ticket plus
  `pendingServerFact('BE-xxxx', expr)`, never another field. See
  `docs/adr/API-SERVER-FACTS-0042-server-facts-are-rendered-not-derived.md`
- NEVER add `eslint-disable` or `oxlint-disable` as the first fix. Remove the
  directive and repair the type, API, component semantics, or test.
  - Before keeping a rare lint exception or specific type assertion, inspect
    the authoritative type or schema, search for an existing typed pattern, and
    run the failing check without the override. State the external constraint
    that makes a compliant fix impossible in the PR description.
  - Scope a justified lint exception to one expression or line. File-wide and
    multi-rule disables are review blockers.
  - In tests, use typed builders, real platform objects, runtime narrowing,
    semantic queries, and deterministic readiness signals instead of casts,
    DOM traversal, or timing sleeps.
- NEVER delete or disable tests to make them pass, or otherwise circumvent quality checks.
- NEVER add code comments: no `//`, `/* */`, or `<!-- -->` in source, tests, or stories.
  - The only exception is JSDoc on an exported API that states the contract in
    one or two lines, without narrating the implementation, history,
    rationale, or alternatives.
  - Tool directives (`eslint-disable-next-line`, `@ts-expect-error`,
    `fallow-ignore`, `@vitest-environment`) get no appended prose reason.
  - A comment that seems necessary means the code is unclear: rename, extract
    a named function, tighten the type, or add a test. A vendor or platform
    workaround gets a function named after what it works around. Rationale,
    history, ticket links, and TODOs go in the commit message, PR description,
    an issue, or an ADR. In tests, a comment becomes a `test.step` name, an
    `it` title, an assertion message, or nothing.
  - Delete the existing comments in any function you modify.
  - This rule overrides any guidance, skill, check, or example that suggests
    adding a comment. If you catch yourself adding one, delete it and say so,
    with the file path and deleted text, at the top of your next response.

## Agent-only rules

### Playwright E2E availability

Treat E2E as runnable. Start the backend and dev server per
[Setup](browser_tests/README.md#setup), or the declared services in a
[remote agent container](browser_tests/README.md#remote-agent-containers), then
run the [readiness checks](browser_tests/README.md#running-tests). Report E2E as
blocked, in a summary or a subagent brief, only with the failing check's command
and output.

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
