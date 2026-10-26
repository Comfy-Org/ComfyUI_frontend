import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setComboInputOptions(
          objectInfo,
          'CheckpointLoaderSimple',
          'ckpt_name',
          [6, 8, 10]
        )
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe('Numeric combo stepping', { tag: ['@widget', '@canvas'] }, () => {
  test('increments to the next numeric combo option', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('numeric-combo-stepping')

    const nodes = await comfyPage.nodeOps.getNodeRefsByType(
      'CheckpointLoaderSimple'
    )
    expect(nodes, 'Workflow has one CheckpointLoaderSimple node').toHaveLength(
      1
    )
    const node = nodes[0]
    const widget = await node.getWidget(0)

    const [x, y] = await comfyPage.page.evaluate(
      ([nodeId, widgetIndex]) => {
        const node = window.app!.canvas.graph!.getNodeById(nodeId)
        if (!node) throw new Error(`Node ${nodeId} not found.`)
        const widget = node.widgets![widgetIndex]

        const [nodeX, nodeY, nodeWidth] = node.getBounding()
        return window.app!.canvasPosToClientPos([
          nodeX + nodeWidth - 20,
          nodeY + window.LiteGraph!['NODE_TITLE_HEIGHT'] + widget.last_y! + 1
        ])
      },
      [node.id, 0] as const
    )

    await expect.poll(() => widget.getValue()).toBe(8)

    await comfyPage.canvas.click({ position: { x, y } })

    await expect.poll(() => widget.getValue()).toBe(10)
  })
})
