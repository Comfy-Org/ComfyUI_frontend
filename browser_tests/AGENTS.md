# E2E Testing Guidelines

See `@docs/guidance/playwright.md` for Playwright best practices (auto-loaded for `*.spec.ts`).
See `@browser_tests/FLAKE_PREVENTION_RULES.md` when triaging or editing
flaky browser tests.

## Directory Structure

```text
browser_tests/
├── assets/           - Test data (JSON workflows, images)
├── fixtures/
│   ├── ComfyPage.ts      - Main fixture (delegates to helpers)
│   ├── ComfyMouse.ts     - Mouse interaction helper
│   ├── VueNodeHelpers.ts - Vue Nodes 2.0 helpers
│   ├── selectors.ts      - Centralized TestIds
│   ├── data/             - Static test data (mock API responses, workflow JSONs, node definitions)
│   ├── components/       - Page object components (locators, user interactions)
│   │   ├── ContextMenu.ts
│   │   ├── SettingDialog.ts
│   │   ├── SidebarTab.ts
│   │   └── Topbar.ts
│   ├── helpers/          - Focused helper classes (domain-specific actions)
│   │   ├── CanvasHelper.ts
│   │   ├── CommandHelper.ts
│   │   ├── KeyboardHelper.ts
│   │   ├── NodeOperationsHelper.ts
│   │   ├── SettingsHelper.ts
│   │   ├── WorkflowHelper.ts
│   │   └── ...
│   └── utils/            - Pure utility functions (no page dependency)
├── helpers/          - Test-specific utilities
└── tests/            - Test files (*.spec.ts)
```

### Architectural Separation

- **`fixtures/data/`** — Static test data only. Mock API responses, workflow JSONs, node definitions. No code, no imports from Playwright.
- **`fixtures/components/`** — Page object components. Encapsulate locators and user interactions for a specific UI area.
- **`fixtures/helpers/`** — Focused helper classes. Domain-specific actions that coordinate multiple page objects (e.g. canvas operations, workflow loading).
- **`fixtures/utils/`** — Pure utility functions. No `Page` dependency; stateless helpers that can be used anywhere.

## Page Object Locator Style

Define UI element locators as `public readonly` properties assigned in the constructor — not as getter methods. Getters that simply return a locator add unnecessary indirection and hide the object shape from IDE auto-complete.

```typescript
// ✅ Correct — public readonly, assigned in constructor
export class MyDialog extends BaseDialog {
  public readonly submitButton: Locator
  public readonly cancelButton: Locator

  constructor(page: Page) {
    super(page)
    this.submitButton = this.root.getByRole('button', { name: 'Submit' })
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' })
  }
}

// ❌ Avoid — getter-based locators
export class MyDialog extends BaseDialog {
  get submitButton() {
    return this.root.getByRole('button', { name: 'Submit' })
  }
}
```

**Keep as getters only when:**

- Lazy initialization is needed (`this._tab ??= new Tab(this.page)`)
- The value is computed from runtime state (e.g. `get id() { return this.userIds[index] }`)
- It's a private convenience accessor (e.g. `private get page() { return this.comfyPage.page }`)

When a class has cached locator properties, prefer reusing them in methods rather than rebuilding locators from scratch.

## Polling Assertions

Prefer `expect.poll()` over `expect(async () => { ... }).toPass()` when the block contains a single async call with a single assertion. `expect.poll()` is more readable and gives better error messages (shows actual vs expected on failure).

```typescript
// ✅ Correct — single async call + single assertion
await expect
  .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 250 })
  .toBe(0)

// ❌ Avoid — nested expect inside toPass
await expect(async () => {
  expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
}).toPass({ timeout: 250 })
```

Reserve `toPass()` for blocks with multiple assertions or complex async logic that can't be expressed as a single polled value.

## Gotchas

| Symptom                                            | Cause                                       | Fix                                                                                                     |
| -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `subtree intercepts pointer events` on DOM widgets | Canvas `z-999` overlay intercepts `click()` | Use Playwright's `locator.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })` |
| Context menu empty or wrong items                  | Node not selected                           | Select node first: `vueNodes.selectNode()` or `nodeRef.click('title')`                                  |
| `navigateIntoSubgraph` timeout                     | Node too small in test asset JSON           | Use node size `[400, 200]` minimum                                                                      |

## After Making Changes

- Run `pnpm typecheck:browser` after modifying TypeScript files in this directory
- Run `pnpm exec eslint browser_tests/path/to/file.ts` to lint specific files
- Run `pnpm exec oxlint browser_tests/path/to/file.ts` to check with oxlint

## Skill Documentation

A Playwright test-writing skill exists at `.claude/skills/writing-playwright-tests/SKILL.md`.

The skill documents **meta-level guidance only** (gotchas, anti-patterns, decision guides). It does **not** duplicate fixture APIs - agents should read the fixture code directly in `browser_tests/fixtures/`.


