# Properties Panel E2E Tests

Tests for the right-side properties panel (`RightSidePanel.vue`).

## Structure

| File | Coverage |
|---|---|
| `openClose.spec.ts` | Panel open/close via actionbar and close button |
| `workflowOverview.spec.ts` | No-selection state: tabs, nodes list, global settings |
| `nodeSelection.spec.ts` | Single/multi-node selection, selection changes, tab labels |
| `titleEditing.spec.ts` | Node title editing via pencil icon |
| `searchFiltering.spec.ts` | Widget search and clear |
| `nodeSettings.spec.ts` | Settings tab: node state, color, pinned (requires VueNodes) |
| `infoTab.spec.ts` | Node help content |
| `errorsTab.spec.ts` | Errors tab visibility |
| `propertiesPanelPosition.spec.ts` | Panel position relative to sidebar |

## Shared Helper

`PropertiesPanelHelper.ts` — Encapsulates panel locators and actions. Instantiated in `beforeEach`:

```typescript
let panel: PropertiesPanelHelper
test.beforeEach(async ({ comfyPage }) => {
  panel = new PropertiesPanelHelper(comfyPage.page)
})
```

## Conventions

- Tests requiring VueNodes rendering enable it in `beforeEach` via `comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)` and call `comfyPage.vueNodes.waitForNodes()`.
- Verify node state changes via user-facing indicators (text labels like "Bypassed"/"Muted", pin indicator test IDs) rather than internal properties.
- Color changes are verified via `page.evaluate` accessing node properties, per the guidance in `docs/guidance/playwright.md`.
