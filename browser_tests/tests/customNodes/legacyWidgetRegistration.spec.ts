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

const EXPECTED_WIDGET_ORDER = [
  'pre_attach_third',
  'pre_attach_first',
  'pre_attach_second'
]

test.use({
  initialSettings: {
    ...customNodeSuiteSettings,
    'Comfy.VueNodes.Enabled': true
  }
})

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

test.afterEach(async ({ comfyPage }) => {
  expect(
    await drainBackendToIdle(comfyPage.page, 10_000),
    'test-owned backend work did not reach idle during cleanup'
  ).toBe(0)
})

test.describe('legacy widget registration', { tag: '@custom-nodes' }, () => {
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
      const detachedWidgetNames = (node.widgets ?? []).map(
        (widget) => widget.name
      )
      window.app!.graph.add(node)
      return {
        id: String(node.id),
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

    expect(
      created!.detachedWidgetNames,
      'fixture did not build its widgets before graph attachment'
    ).toEqual(EXPECTED_WIDGET_ORDER)

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

    await expect
      .poll(
        () =>
          rows.evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-widget-name'))
          ),
        { message: 'Nodes 2.0 rendered the widget rows in the wrong order' }
      )
      .toEqual(EXPECTED_WIDGET_ORDER)

    await expectNoVisibleErrors(comfyPage.page, 'after mounting legacy widgets')
  })
})
