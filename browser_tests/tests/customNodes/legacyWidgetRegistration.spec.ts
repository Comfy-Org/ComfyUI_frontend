import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  runWithCollectedCleanup,
  submittedPromptCount,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

const NODE_TYPE = 'DevToolsNodeWithPreAttachLegacyWidgets'

const WIDGET_FILL = {
  pre_attach_first: '255,0,0',
  pre_attach_second: '0,255,0',
  pre_attach_third: '0,0,255'
} as const

const EXPECTED_WIDGET_ORDER = [
  'pre_attach_third',
  'pre_attach_first',
  'pre_attach_second'
] as const

const EXPECTED_RENDERED_FILLS = EXPECTED_WIDGET_ORDER.map(
  (name) => WIDGET_FILL[name]
)

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
  await runWithCollectedCleanup(async () => {
    expect(
      await submittedPromptCount(comfyPage.page),
      'legacy widget registration submitted a prompt'
    ).toBe(0)
  }, [
    async () => {
      expect(
        await drainBackendToIdle(comfyPage.page, 10_000),
        'legacy widget registration left test-owned backend work running'
      ).toBe(0)
    }
  ])
})

test.describe('legacy widget registration', { tag: '@custom-nodes' }, () => {
  test.describe.configure({ timeout: 30_000 })

  test('renders foreign widgets built before graph attachment', async ({
    comfyPage
  }) => {
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

    const widgetCanvases = node
      .getByTestId(TestIds.widgets.widget)
      .locator('canvas')

    await expect
      .poll(
        () =>
          widgetCanvases.evaluateAll((canvases) =>
            canvases.map((element) => {
              if (!(element instanceof HTMLCanvasElement)) return 'not-a-canvas'
              if (!element.width || !element.height) return 'unsized'
              const ctx = element.getContext('2d')
              if (!ctx) return 'no-2d-context'
              const [red, green, blue, alpha] = ctx.getImageData(
                Math.floor(element.width / 2),
                Math.floor(element.height / 2),
                1,
                1
              ).data
              return alpha === 0 ? 'never-drawn' : `${red},${green},${blue}`
            })
          ),
        {
          message:
            'Nodes 2.0 did not paint one legacy widget per row in node.widgets order'
        }
      )
      .toEqual(EXPECTED_RENDERED_FILLS)

    await expectNoVisibleErrors(comfyPage.page, 'after mounting legacy widgets')
  })
})
