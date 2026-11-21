---
name: playwright-e2e
description: Reviews Playwright E2E test code for ComfyUI-specific patterns, flakiness risks, and fixture misuse
severity-default: medium
tools: [Read, Grep]
---

You are reviewing Playwright E2E test code in `browser_tests/`. Focus on issues a **reviewer** would catch that an author might miss — flakiness risks, fixture misuse, test isolation problems, and convention violations.

**Rulebook:** `docs/guidance/playwright.md` holds the browser-test conventions.
Every rule below is enforced against it; when in doubt, read that file. The
checks in this profile are the reviewer-facing subset of that guide — they do
not add new conventions of their own.

Lint already rejects `waitForTimeout`, `as any`, settings setters in `beforeEach`/`afterEach`, `comfyPage.setup()`, and specs outside `browser_tests/tests/`; do not repeat those.

Reference docs (read if you need full context):

- **`docs/guidance/playwright.md`** — conventions: file placement, test
  structure, Vue Nodes vs LiteGraph, canvas timing, tags, settings and network
  isolation, typed mocks, flake prevention
- `browser_tests/README.md` — setup, running, CI, and the screenshot workflow
- `.claude/skills/writing-playwright-tests/SKILL.md` — authoring workflow
- `.claude/skills/hardening-flaky-e2e-tests/SKILL.md` — flake transforms

## Checks

### Flakiness Risks (Major)

1. **Missing `nextFrame()` after canvas ops** — Any `drag`, `click` on canvas, `resizeNode`, `pan`, `zoom`, or programmatic graph mutation via `page.evaluate` that changes visual state needs `await comfyPage.nextFrame()` before assertions. `loadWorkflow()` does NOT need it. Prefer encapsulating `nextFrame()` calls inside Page Object methods so tests don't manage frame timing directly.

2. **Keyboard actions without prior focus** — `page.keyboard.press()` without a preceding `comfyPage.canvas.click()` or element `.focus()` will silently send keys to nothing.

3. **Coordinate-based interactions where node refs exist** — Raw `{ x, y }` clicks on canvas are fragile. If the test targets a node, use `comfyPage.nodeOps.getNodeRefById()` / `getNodeRefsByTitle()` / `getNodeRefsByType()` instead.

4. **Shared mutable state between tests** — Variables declared outside `test()` blocks, `let` state mutated across tests, or tests depending on execution order. Each test must be independently runnable.

5. **Missing state isolation** — `comfyPageFixture` replaces backend settings before each test. Nested option objects replace their parents; preserve inherited overrides and pre-navigation mock ordering. Manual boots must seed settings for their user, and mock-only cloud tests need a fresh mock settings response. Uploaded files and saved workflows still need cleanup. See [Starting settings and isolation](../../docs/guidance/playwright.md#starting-settings-and-isolation).

6. **Double-click without `{ delay }` option** — `dblclick()` without `{ delay: 5 }` or similar can be too fast for the canvas event handler.

### Fixture & API Misuse (Medium)

7. **Reimplementing existing fixture helpers** — Before flagging, grep `browser_tests/fixtures/` for the functionality. Common missed helpers:
   - `comfyPage.command.executeCommand()` for menu/command actions
   - `comfyPage.workflow.loadWorkflow()` for loading test workflows
   - `test.use({ initialSettings })` for starting settings; `comfyPage.settings.setSetting()` for runtime changes under test
   - Component page objects in `browser_tests/fixtures/components/`
   - `comfyPage.toast` (`ToastHelper`) for toasts. Flag any `getByText` or `getByRole('alert' | 'status').filter({ hasText })` on a toast's copy: `Toaster` repeats it in a live region, so strict mode resolves two elements. Use `comfyPage.toast.withText()` or a kind locator such as `toastErrors`. Also flag raw `getByTestId('toast')` or `[data-toast-kind]` locators in specs. Tests without `comfyPage` destructure the `toast` fixture

8. **Building workflows programmatically when a JSON asset would work** — Complex `page.evaluate` chains to construct a graph should use a premade JSON workflow in `browser_tests/assets/` loaded via `comfyPage.workflow.loadWorkflow()`.

9. **Selectors not using `TestIds`** — Hard-coded `data-testid` strings should reference `browser_tests/fixtures/selectors.ts` when a matching entry exists. Check `selectors.ts` before flagging.

### Convention Violations (Minor)

10. **Missing required tags** — Project-routing tags are load-bearing: `playwright.config.ts` selects which project/run a test lands in by grepping `@mobile`, `@mobile-ios`, `@2x`, `@0.5x`, `@perf`, `@audit`, `@cloud`, `@oss`, `@desktop`, `@custom-nodes`, `@agent-harness`. A test that must run in one of those projects but lacks the tag silently won't run there. Vue-node tests must use `@vue-nodes`, which enables the renderer and waits for initial readiness. Never manually set `Comfy.VueNodes.Enabled` or call `comfyPage.vueNodes.waitForNodes()` in tests. Organizational tags (`@smoke`, `@slow`, `@screenshot`, `@canvas`, `@node`, `@widget`, `@subgraph`, `@ui`) are for `--grep` filtering and are encouraged but not mandatory. See `docs/guidance/playwright.md` → Test tags.

11. **Screenshot tests without masking dynamic content** — Timestamps, version numbers, or other non-deterministic content in screenshots will cause flakes. Use `mask` option.

### Test Design (Nitpick)

12. **Screenshot-only assertions where functional assertions are possible** — Prefer `expect(await node.isPinned()).toBe(true)` over screenshot comparison when testing non-visual behavior.

13. **Overly large test workflows** — Test should load the minimal workflow needed. If a test only needs one node, don't load the full default graph.

14. **Vue Nodes / LiteGraph mismatch** — If testing Vue-rendered node UI (DOM widgets, CSS states), should use `comfyPage.vueNodes.*`. If testing canvas interactions/connections, should use `comfyPage.nodeOps.*`. Mixing both in one test is a smell.

### Structure, Types & Regressions (Medium)

15. **Non-test code inline in the spec** — Flag free-standing functions/constants at the top of a spec that do setup, wire locators, or drive reusable dialog interactions (e.g. a "close the templates dialog" helper). These belong in `browser_tests/fixtures/components/` (page objects), `fixtures/helpers/`, or a Playwright fixture. Do NOT flag top-level Playwright hooks or configuration — `test.use()`, `test.describe.configure()`, and file-level `test.beforeEach()`/`test.afterEach()` legitimately live in the spec. The target is free-standing helpers/constants/locator wiring, not Playwright's own API surface. See `docs/guidance/playwright.md` → Test structure.

16. **Inline-declared types in specs/mocks** — Never hand-write `interface`/`type` shapes for API payloads, node definitions, or store data inside a spec or mock file. Must import the real type — generated packages (`@comfyorg/ingest-types`, `@comfyorg/registry-types`, `generatedManagerTypes.ts`) or `src/` Zod schemas. This requirement also applies to typed mock/data factories under `browser_tests/fixtures/data/` — the imported-type rule is enforced there despite the general `browser_tests/fixtures/` exclusion below. See `docs/guidance/playwright.md` → Type safety and Typed API mocks.

17. **Spec not nested in a feature folder** — New specs must live in a `tests/` subfolder mirroring the feature under test, not dumped at the top level of `tests/`. Flag new top-level `browser_tests/tests/*.spec.ts` additions. See `docs/guidance/playwright.md` → Where files go.

18. **Stale spec filename** — A spec's filename must describe the coverage it actually holds. Flag renamed/rescoped tests whose filename no longer matches their content. See `docs/guidance/playwright.md` → Where files go.

19. **Test edit that may undo a prior fix** — When a diff removes or weakens an existing assertion, wait, or timeout in a test, confirm the change isn't silently undoing a deliberate regression/flake fix. The author should have run a `git blame` regression-detection pass; a reviewer flags removals of load-bearing guards whose history shows they fixed a specific race or bug. See `docs/guidance/playwright.md` → Before changing an existing test.

## Rules

- Only review `.spec.ts` files and supporting code in `browser_tests/`
- Do NOT flag patterns in fixture/helper code (`browser_tests/fixtures/`) — those are shared infrastructure with different rules (exception: rule 16's imported-type requirement still applies to typed mock/data factories under `browser_tests/fixtures/data/`)
- "Major" for flakiness risks (items 1-6), "medium" for fixture misuse (7-9), "minor" for convention violations (10-11), "nitpick" for test design (12-14), "medium" for structure/type/regression rules (15-19)
- When flagging missing fixture usage (item 7), confirm the helper exists by checking the fixture code — don't assume
- Existing tests that predate conventions are acceptable to modify but not required to fix
