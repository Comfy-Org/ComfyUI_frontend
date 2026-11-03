---
globs:
  - '**/*.spec.ts'
  - 'browser_tests/**/*.ts'
---

# Playwright E2E Conventions

How to write and change browser tests. Setup, running, CI, and screenshot
baselines are in [`browser_tests/README.md`](../../browser_tests/README.md).
Design rules for every test level are in `testing-principles.md`; this file
covers the Playwright and ComfyUI mechanics.

## Golden rules

1. **Look at existing tests first.** Search `browser_tests/tests/` for similar
   patterns.
2. **Read the fixture code.** The APIs live in `browser_tests/fixtures/`; read
   them instead of guessing.
3. **Use premade JSON workflow assets** instead of building graphs
   programmatically. Assets live in `browser_tests/assets/`; create one by
   copying `assets/default.json` and editing the JSON. Load the smallest
   workflow the test needs.

## Before changing an existing test

`git blame` the lines you are about to change and read the commit that
introduced them. An assertion, wait, or timeout that looks redundant is often a
fix for a past flake or bug. Keep the guarantee, or replace it with an
equivalent.

## Where files go

- Nest specs in the `tests/` subfolder that mirrors the feature under test. Do
  not add specs at the top level of `tests/`.
- A spec's filename describes the coverage it holds. Rename the file when its
  scope changes.
- `fixtures/data/`: typed mock data and the functions that build it. No
  Playwright imports, no test logic.
- `fixtures/components/`: page object classes that own the locators of one UI
  region.
- `fixtures/helpers/`: classes that coordinate actions across regions without
  owning a locator surface.
- `fixtures/utils/`: standalone exported functions used by tests or fixtures.

## Test structure

- Mock setup, state, and fixture arrangement go in `test.beforeEach()` or a
  Playwright fixture. Inside `test()`, only act and assert.
- Never call `clearAllMocks` or reset mock state mid-test.
- A spec contains imports, `test.describe`/`test` blocks, and Playwright hooks
  and configuration (`test.use()`, `test.describe.configure()`, file-level
  `beforeEach`/`afterEach`). Move free-standing helpers, constants, and locator
  wiring into a page object, helper, or fixture.
- Import within `browser_tests/` through `@e2e/*` and from `src/` through
  `@/*`. Do not add deep relative imports.

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Node pinning', { tag: ['@canvas', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
  })

  test('pins the selected node with the P key', async ({ comfyPage }) => {
    const ksampler = await comfyPage.nodeOps.getNodeRefById(3)
    await ksampler.click('title')
    await comfyPage.keyboard.press('KeyP')
    await expect(ksampler).toBePinned()
  })
})
```

## Helpers, page objects, and assertions

- `ComfyPage` delegates to helper objects such as `comfyPage.workflow`,
  `comfyPage.settings`, `comfyPage.command`, and `comfyPage.nodeOps`. Check
  `fixtures/` for an existing helper before writing one.
- Register a new domain helper as a Playwright fixture with `base.extend()` on
  `@playwright/test`, not as a new `ComfyPage` property. Fixtures get setup
  and teardown and compose with `mergeTests`.

```typescript
export const test = base.extend<{ assetHelper: AssetHelper }>({
  assetHelper: async ({ page }, use) => {
    const helper = new AssetHelper(page)
    await helper.setup()
    await use(helper)
    await helper.cleanup()
  }
})
```

- Page objects declare locators as `public readonly` properties assigned in
  the constructor, not getters. Keep getters for lazy init, runtime-computed
  values, or private accessors. Reuse the cached locators in methods.
- Add new assertions as page-object methods. The existing `comfyExpect`
  matchers in `fixtures/utils/customMatchers.ts` stay supported; do not add
  new ones.
- Attach a message to precondition checks so a failure names the broken
  assumption. Use `expect.soft()` to check several invariants in one pass.

## Selectors

- Prefer role, label, or test-id selectors to CSS or DOM-structure selectors.
- Reference `fixtures/selectors.ts` for a `data-testid` it already defines.
- When nodes share a title, disambiguate with
  `vueNodes.getNodeByTitle(name).nth(n)`; strict mode fails on ambiguous
  locators.
- Never locate a toast by its text with `getByText` or
  `getByRole('alert' | 'status').filter({ hasText })`: `Toaster` repeats every
  toast's text in live regions with those roles. Use
  `comfyPage.toast.withText(text)` and its kind locators such as
  `toastErrors`. Tests without `comfyPage` destructure the `toast` fixture.
  Specs may not construct a `ToastHelper`.
- Target nodes by reference from `fixtures/utils/litegraphUtils.ts`, not by
  canvas coordinates. When a type can match more than one node, use
  `getNodeRefById()` or guard with `toHaveLength(1)`; the order of
  `getNodeRefsByType()` is not deterministic. Keep coordinates only for empty
  canvas clicks, pans, and zooms.

```typescript
const node = await comfyPage.nodeOps.getNodeRefById('12')
await node.click('title')
```

## Vue Nodes vs LiteGraph

| Testing…                                       | Use                              |
| ---------------------------------------------- | -------------------------------- |
| Vue-rendered node UI, DOM widgets, CSS states  | `comfyPage.vueNodes.*` locators  |
| Canvas interactions, connections, legacy nodes | `comfyPage.nodeOps.*` references |
| Both in one test                               | Pick one; mixing is a smell      |

Tag a test or `test.describe` with `@vue-nodes` when it needs Vue Nodes. The
fixture enables the renderer before boot and waits for the nodes. Never set
`Comfy.VueNodes.Enabled`, including through `initialSettings`, and never call
`comfyPage.vueNodes.waitForNodes()` in tests. Untagged tests start in classic
mode.

When renderer switching is the behavior under test, keep `@vue-nodes` and use
`comfyPage.menu.topbar.setVueNodesEnabled(enabled)`, or
`comfyPage.command.executeCommand('Experimental.ToggleVueNodes')` when an
overlay blocks the menu.

Vue node state is a CSS class: `await expect(node).toHaveClass(/before:bg-bypass\/60/)`.

## Canvas timing

- After a drag, canvas click, resize, pan, zoom, or a `page.evaluate` graph
  mutation, `await comfyPage.nextFrame()` before asserting. `loadWorkflow()`
  does not need it. Prefer putting `nextFrame()` inside page-object methods.
- Click the canvas before keyboard input, or the keys go nowhere.
- After a programmatic state change, mark the canvas dirty:
  `window.app!.graph!.setDirtyCanvas(true, true)`.
- Canvas `dblclick()` needs `{ delay: 5 }`. Use the shared drag helpers; for a
  local drag, use the fewest steps the behavior needs (usually 5–20).

## Test tags

`playwright.config.ts` selects projects by tag. The default `chromium` project
skips tests tagged `@mobile`, `@perf`, `@audit`, `@cloud`, `@desktop`,
`@custom-nodes`, or `@agent-harness`, so those run only in their own project;
`@2x` and `@0.5x` add a project and the test still runs in `chromium`:

| Tag              | Effect                                                   |
| ---------------- | -------------------------------------------------------- |
| `@mobile`        | Runs in the mobile-chrome (Pixel 5) project              |
| `@mobile-ios`    | Runs in the mobile-safari (iPhone 15 / WebKit) project   |
| `@2x`            | Also runs in the 2x-scale project                        |
| `@0.5x`          | Also runs in the 0.5x-scale project                      |
| `@perf`          | Runs in the perf project                                 |
| `@audit`         | Runs in the audit project                                |
| `@cloud`         | Runs in the cloud project                                |
| `@desktop`       | Runs against the desktop build                           |
| `@custom-nodes`  | Runs serially in the custom-nodes project                |
| `@agent-harness` | Runs in the agent-harness project; no CI project runs it |
| `@oss`           | Excluded from the cloud project                          |

- Use `@mobile-ios` only for regressions that reproduce under iOS conditions.
  WebKit does not expose embedded-WKWebView globals such as
  `window.webkit.messageHandlers`; inject them with `page.addInitScript()` and
  set the context `userAgent`, as `tests/cloudLoginIosWebview.spec.ts` does.
- `@desktop` only selects the project. Tests that need Electron APIs import
  `desktopFixture` from `@e2e/fixtures/desktopFixture`.
- Area tags make a test findable with `--grep`. `pnpm comfy-test tags` lists
  them with their meanings. `@vue-nodes` also controls fixture setup.

## Type safety

- Never use `any` or `as any`. Forbidden: `settings: testData as any`,
  `data as unknown as SomeType`.
- `window.app`, `window.graph`, and `window.LiteGraph` are optional in app
  types; E2E code may use non-null assertions on them
  (`window.app!.graph!.nodes`).
- Never declare an `interface` or `type` for API payloads, node definitions,
  or store data in a test. Import the real type (see
  [Typed API mocks](#typed-api-mocks)).
- Read internal state through `page.evaluate` and stores; do not widen public
  API types to expose internals.

## When to use `page.evaluate`

Use it sparingly to read state with no UI representation or to set up
fixtures. Never use it for an action with a UI equivalent: fill the widget,
click the button, queue through the button. Prefer helpers in
`fixtures/helpers/` that wrap real user interactions.

## Starting settings and isolation

Set starting settings with `test.use({ initialSettings })` at the narrowest
file or describe scope, not `setSetting` in `beforeEach`.

- `comfyPageFixture` replaces the worker user's settings file before each test:
  the common baseline, then the `@vue-nodes` override, then `initialSettings`.
  The browser context is test-scoped and storage is cleared. Do not reset
  settings in `afterEach`.
- Nested `test.use` replaces the parent's `initialSettings` object; repeat
  every override the nested scope needs.
- Keep runtime `setSetting` calls only when a live change or persistence is the
  behavior under test.
- `test.use({ initialUrl: '/?template=template_id' })` sets the first app URL;
  `initialLocalStorage` seeds storage before it.
- Install mocks that startup settings depend on before `comfyPage` boots.
- Manual backend boots call `comfyPage.setupSettings({ userId, settings })`
  before navigation; `ComfyPage.setup()` alone does not reset settings.
- Mock-only cloud tests get a fresh settings response per test from their boot
  helper; use a stateful mock to test persistence across reloads.
- Uploaded files and saved workflows are not covered by the baseline. Clean
  them up in the owning fixture or `afterEach`.

## Network isolation

Every browser request outside the configured frontend and backend origins
needs a `route.fulfill()` or deliberate `route.abort()` mock; an unmocked
request fails its test. Use `route.fallback()` for unmatched requests, never
`route.continue()`. Mock popups on `context`, not `page`. Use
`test.use({ userAgent })` instead of `browser.newContext()`. Build custom test
roots on `fixtures/networkIsolationFixture.ts`; oxlint bans raw Playwright
`test` imports and `route.continue()` everywhere else.

## Typed API mocks

Mock data in `fixtures/data/` is typed against generated types or Zod
schemas, never untyped inline JSON.

`comfyPageFixture` navigates during setup, before the test body. Destructuring
`{ comfyPage }` in a hook triggers that navigation before the hook runs, so
register routes from a custom fixture or a `beforeEach` that takes only
`{ page }`.

```typescript
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { autogrowThenMaskNodeDef } from '@e2e/fixtures/data/autogrowThenMaskNodeDef'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unroute = await routeObjectInfoFromSetupApi(page, (objectInfo) => {
      objectInfo[autogrowThenMaskNodeDef.name] = autogrowThenMaskNodeDef
    })
    try {
      await use(page)
    } finally {
      await unroute()
    }
  }
})
```

| Endpoint                                          | Type source                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cloud-only (hub, billing, workflows)              | `@comfyorg/ingest-types`                                                               |
| Registry (releases, nodes, publishers)            | `@comfyorg/registry-types`                                                             |
| Manager (queue tasks, packages)                   | `@comfyorg/api-client/generatedManagerTypes`                                           |
| Local webserver responses that differ from ingest | `@comfyorg/api-client/types`                                                           |
| WebSocket messages and custom-node outputs        | `@comfyorg/api-client/executionTypes`                                                  |
| Frontend settings                                 | `@comfyorg/settings-core/types`                                                        |
| Node definitions                                  | `@comfyorg/object-info-parser`, `@comfyorg/object-info-parser/schemas/nodeDefSchemaV2` |
| Templates                                         | `@comfyorg/api-client/templateTypes`                                                   |
| Jobs API                                          | `@comfyorg/api-client/jobTypes`                                                        |
| Workflow JSON                                     | `@comfyorg/graph-model/workflowSchema`                                                 |
| Asset metadata                                    | `src/types/metadataTypes.ts`                                                           |

When mocking a raw endpoint body, annotate it with the generated type, not an
app-facing type derived from it. Keep values stable: no current dates or
random IDs.

## Screenshots

Use a screenshot only when appearance is the behavior under test. Capture only
the area under test with `expectElementScreenshot`, `expectRegionScreenshot`,
or `screenshotRegion` from `@e2e/fixtures/utils/screenshotRegion`; lint
rejects `toHaveScreenshot` in specs. Tag screenshot tests `@screenshot`.
Assert the expected state with a retrying assertion before the capture. If a
canvas diff is only a viewport shift, pin the pan and zoom instead of
re-baselining. Never commit local baselines; see the README for the CI
baseline workflow.

## Flake prevention

### Choose the smallest correct assertion

- Locator state: retrying assertions (`toBeVisible`, `toHaveText`,
  `toHaveCount`, `toHaveClass`).
- One async value: `await expect.poll(() => fn()).toBe(expected)`.
- Several assertions that must settle together:
  `await expect(async () => { … }).toPass()`.
- Never assert immediately after an async UI mutation, settings write,
  clipboard write, or graph update.
- Never use `waitForTimeout()`. Keep the default poll timeout (5000 ms); never
  go below about 2000 ms.
- Do not use `force: true`; it bypasses the actionability checks that expose
  the race.

### Wait for the real readiness boundary

Visible is not always ready. Wait on the state the behavior depends on:
`node.imgs` before an image context menu, settings cleanup before asserting
persisted state, a locale reload before selecting nodes, the real builder UI
rather than transient helper metadata. Shared helpers drive setup to a stable
boundary; a timing assumption that only one spec needs stays in that spec.

### Common flake patterns

| Pattern                             | Bad                                                | Fix                                                                      |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Snapshot then assert                | `expect(await evaluate()).toBe(x)`                 | `await expect.poll(() => evaluate()).toBe(x)`                            |
| Immediate layout read               | `expect((await loc.boundingBox())!.width).toBe(w)` | `await expect.poll(() => loc.boundingBox().then(b => b?.width)).toBe(w)` |
| Immediate graph state after drop    | `expect(await getLinkCount()).toBe(1)`             | `await expect.poll(() => getLinkCount()).toBe(1)`                        |
| Immediate count                     | `expect(await loc.count()).toBe(3)`                | `await expect(loc).toHaveCount(3)`                                       |
| Fake readiness helper               | Helper clicks but asserts nothing                  | Remove it; poll the actual value                                         |
| `nextFrame()` after menu click      | `clickMenuItem(x); nextFrame()`                    | `clickMenuItem(x); contextMenu.waitForHidden()`                          |
| Check-then-act in a helper          | `if (await loc.count()) await loc.waitFor(…)`      | `await loc.waitFor({ state: 'hidden' })`                                 |
| Count method on a helper            | Helper returns `await loc.count()`                 | Expose the `Locator` so callers use `toHaveCount`                        |
| Screenshot without readiness        | `loadWorkflow(); nextFrame(); screenshot`          | Assert the expected node state first                                     |
| Non-deterministic node order        | `getNodeRefsByType('X')[0]` with several matches   | `getNodeRefById(id)` or guard `toHaveLength(1)`                          |
| Dismiss guard with a built-in delay | Click, then assert hidden once                     | Retry click and `toBeHidden` together inside `toPass()`                  |

## Gotchas

| Symptom                                            | Cause                                    | Fix                                                                                    |
| -------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `subtree intercepts pointer events` on DOM widgets | Canvas `z-999` overlay intercepts clicks | `locator.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })` |
| Context menu empty or wrong items                  | Node not selected                        | Select first: `vueNodes.selectNode()` or `nodeRef.click('title')`                      |
| `navigateIntoSubgraph` timeout                     | Node too small in the asset JSON         | Use a node size of at least `[400, 200]`                                               |
| Keyboard shortcuts do nothing                      | Canvas not focused                       | `await comfyPage.canvas.click()` first                                                 |
| Widget value wrong after drag-drop                 | Upload incomplete                        | Pass `{ waitForUpload: true }`                                                         |

## Agent replay coverage

A fix that changes how the agent's turns affect the app (graph edits, CRDT
frames, panel state) adds a recorded conversation replay case. Recording,
the replay spec, and the red/green proof are in
[`browser_tests/fixtures/data/agent/README.md`](../../browser_tests/fixtures/data/agent/README.md).

## After changing a test

- `pnpm typecheck:browser` after TypeScript changes in `browser_tests/`.
- `pnpm exec eslint <file>` and `pnpm exec oxlint <file>` on the changed files.
- Rerun a flaky path with `pnpm test:browser:local <file>:<line> --repeat-each 10`.
