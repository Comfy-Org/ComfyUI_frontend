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
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

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
    test.setTimeout(30_000)
    await comfyPage.nodeOps.clearGraph()

    const created = await comfyPage.page.evaluate((type) => {
      const node = window.LiteGraph!.createNode(type, undefined, {
        pos: [400, 200]
      })
      if (!node) return null
      // Read before attaching: this is the detached state the pack builds in.
      const detachedWidgetNames = (node.widgets ?? []).map(
        (widget) => widget.name
      )
      window.app!.graph.add(node)
      const id = String(node.id)
      return {
        id,
        detachedWidgetNames,
        attachedWidgetNames: (
          window.app!.graph.getNodeById(node.id)?.widgets ?? []
        ).map((widget) => widget.name)
      }
    }, NODE_TYPE)

    expect(
      created,
      `${NODE_TYPE} is not registered - ComfyUI_devtools is not installed on this backend`
    ).not.toBeNull()

    // Guard, not the regression: proves the fixture really built its rows
    // while the node was detached, in the reordered sequence. Holds both
    // before and after the fix.
    expect(
      created!.detachedWidgetNames,
      'fixture did not build its widgets before graph attachment'
    ).toEqual(EXPECTED_WIDGET_ORDER)

    // Attaching normalizes the live array in place, and the store order Vue
    // renders from is derived from it - so the reorder has to survive.
    expect(
      created!.attachedWidgetNames,
      'graph attachment did not preserve the live widget order'
    ).toEqual(EXPECTED_WIDGET_ORDER)

    const node = comfyPage.vueNodes.getNodeLocator(created!.id)
    await expect(node).toBeVisible()
    const rows = node.getByTestId(TestIds.widgets.widget)
    await expect(
      rows,
      'Nodes 2.0 mounted the node with no widget rows'
    ).toHaveCount(EXPECTED_WIDGET_ORDER.length)

    // Vue renders from the widget value store, not from node.widgets, so the
    // rendered sequence is a separate observation from the live-array one.
    const renderedOrder = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-widget-name'))
    )
    expect(
      renderedOrder,
      'Nodes 2.0 rendered the widget rows in the wrong order'
    ).toEqual(EXPECTED_WIDGET_ORDER)

    await expectNoVisibleErrors(comfyPage.page, 'after mounting legacy widgets')
  })
})
