import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue node level of detail',
  { tag: ['@canvas', '@node', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.setScale(1)
    })

    test('draws boxes below the threshold and restores nodes above it', async ({
      comfyPage
    }) => {
      const nodeId = await comfyPage.vueNodes.nodes
        .first()
        .getAttribute('data-node-id')
      if (!nodeId) throw new Error('Expected a Vue node with an id')
      const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
      const initialSize = await node.getSize()

      await comfyPage.canvasOps.setScale(0.4)
      const overlay = comfyPage.page.getByTestId('node-box-overlay')
      await expect(overlay).toBeVisible()
      await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toHaveCount(0)
      await expect
        .poll(() =>
          overlay.evaluate((element: HTMLCanvasElement, id) => {
            const canvas = window.app!.canvas
            const node = canvas.graph!.getNodeById(id)!
            const [x, y] = canvas.ds.convertOffsetToCanvas([
              node.pos[0] + node.size[0] / 2,
              node.pos[1] + node.size[1] / 2
            ])
            const scale = element.width / element.clientWidth
            return element
              .getContext('2d')!
              .getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1)
              .data[3]
          }, node.id)
        )
        .toBe(255)

      await comfyPage.canvasOps.setScale(1)
      await expect(comfyPage.page.getByTestId('node-box-overlay')).toHaveCount(
        0
      )
      await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      await expect.poll(() => node.getSize()).toEqual(initialSize)
    })

    test('keeps the focused node mounted below the threshold', async ({
      comfyPage
    }) => {
      const focusedNode = comfyPage.vueNodes.nodes.first()
      const focusedElement = await focusedNode.elementHandle()
      const otherNodeId = await comfyPage.vueNodes.nodes
        .nth(1)
        .getAttribute('data-node-id')
      if (!otherNodeId) throw new Error('Expected a second Vue node')
      await focusedNode.focus()

      await comfyPage.canvasOps.setScale(0.4)
      await expect(comfyPage.page.getByTestId('node-box-overlay')).toBeVisible()
      await expect(comfyPage.vueNodes.getNodeLocator(otherNodeId)).toHaveCount(
        0
      )
      await expect
        .poll(() =>
          focusedElement.evaluate((element) =>
            element.contains(document.activeElement)
          )
        )
        .toBe(true)
    })
  }
)
