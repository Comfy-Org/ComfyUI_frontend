import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'

const NODE_TYPE = 'DevToolsNodeWithPreAttachLegacyWidgets'

// web/preAttachLegacyWidgets.js adds three widgets and then moves the last
// one to the front through the live array, so the reordered sequence is what
// both LiteGraph and Vue must agree on.
const EXPECTED_WIDGET_ORDER = [
  'pre_attach_third',
  'pre_attach_first',
  'pre_attach_second'
]

// Nodes 2.0 through settings rather than the @vue-nodes tag: that tag makes
// the fixture wait for a rendered node at startup, which this suite's blank
// startup graph never has.
test.use({
  initialSettings: {
    ...customNodeSuiteSettings,
    'Comfy.VueNodes.Enabled': true
  }
})

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

// This spec queues no prompt of its own; the drain guards against pack JS
// queueing one behind our back and running on into the next test.
test.afterEach(async ({ comfyPage }) => {
  expect(
    await drainBackendToIdle(comfyPage.page, 10_000),
    'test-owned backend work did not reach idle during cleanup'
  ).toBe(0)
})

test.describe('legacy widget registration', { tag: '@custom-nodes' }, () => {
  // Regression: rgthree's Power Lora Loader builds every row in
  // onNodeCreated as a foreign widget object with a type no widget
  // constructor claims, then reorders the live array. Those objects used to
  // stay raw - never registered with the widget value store - so Nodes 2.0
  // mounted the node with zero rows and the pack rendered as a blank box
  // (Comfy-Org/ComfyUI_frontend#16113).
  test('renders foreign widgets built before graph attachment', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()

    const created = await comfyPage.page.evaluate((type) => {
      const node = window.LiteGraph!.createNode(type, undefined, {
        pos: [400, 200]
      })!
      // Read before attaching: this is the detached state the pack builds in.
      const detachedWidgetNames = (node.widgets ?? []).map(
        (widget) => widget.name
      )
      window.app!.graph.add(node)
      return { id: String(node.id), detachedWidgetNames }
    }, NODE_TYPE)

    // Guard, not the regression: proves the fixture really built its rows
    // while the node was detached, in the reordered sequence. Holds both
    // before and after the fix.
    expect(
      created.detachedWidgetNames,
      'fixture did not build its widgets before graph attachment'
    ).toEqual(EXPECTED_WIDGET_ORDER)

    const node = comfyPage.vueNodes.getNodeLocator(created.id)
    await expect(node).toBeVisible()
    await expect(
      node.getByTestId(TestIds.widgets.widget),
      'Nodes 2.0 mounted the node with no widget rows'
    ).toHaveCount(EXPECTED_WIDGET_ORDER.length)
  })
})
