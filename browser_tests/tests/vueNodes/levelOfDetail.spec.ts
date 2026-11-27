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

    test('draws boxes below the threshold and restores the same nodes above it', async ({
      comfyPage
    }) => {
      const initialNode = comfyPage.vueNodes.nodes.first()
      const nodeId = await initialNode.getAttribute('data-node-id')
      if (!nodeId) throw new Error('Expected a Vue node with an id')
      const initialElement = await initialNode.elementHandle()
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
      const restoredNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(restoredNode).toBeVisible()
      const restoredElement = await restoredNode.elementHandle()
      expect(
        await initialElement.evaluate(
          (element, candidate) => element === candidate,
          restoredElement
        ),
        'leaving LOD reattaches the cached node instead of remounting it'
      ).toBe(true)
      await expect.poll(() => node.getSize()).toEqual(initialSize)
    })

    test('moves a dragged node box below the threshold', async ({
      comfyPage
    }) => {
      const nodeId = await comfyPage.vueNodes.nodes
        .first()
        .getAttribute('data-node-id')
      if (!nodeId) throw new Error('Expected a Vue node with an id')
      const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
      await comfyPage.canvasOps.setScale(0.4)
      const overlay = comfyPage.page.getByTestId('node-box-overlay')
      await expect(overlay).toBeVisible()

      const boxAlphaAt = (point: { x: number; y: number }) =>
        overlay.evaluate((element: HTMLCanvasElement, { x, y }) => {
          const scale = element.width / element.clientWidth
          return element
            .getContext('2d')!
            .getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1)
            .data[3]
        }, point)

      const { grip, empty } = await comfyPage.page.evaluate((id) => {
        const canvas = window.app!.canvas
        const node = canvas.graph!.getNodeById(id)!
        const toScreen = (x: number, y: number) => {
          const [screenX, screenY] = canvas.ds.convertOffsetToCanvas([x, y])
          return { x: screenX, y: screenY }
        }
        const lowestEdge = Math.max(
          ...canvas.graph!.nodes.map((other) => other.pos[1] + other.size[1])
        )
        return {
          grip: toScreen(node.pos[0] + node.size[0] / 2, node.pos[1] + 10),
          empty: toScreen(
            node.pos[0] + node.size[0] / 2,
            lowestEdge + node.size[1]
          )
        }
      }, node.id)
      await expect.poll(() => boxAlphaAt(grip)).toBe(255)
      await expect.poll(() => boxAlphaAt(empty)).toBe(0)

      const box = await comfyPage.canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not available')
      const { mouse } = comfyPage.page
      await mouse.move(box.x + grip.x, box.y + grip.y)
      await mouse.down()
      await mouse.move(box.x + empty.x, box.y + empty.y, { steps: 10 })
      await mouse.up()

      await expect.poll(() => boxAlphaAt(empty)).toBe(255)
      await expect.poll(() => boxAlphaAt(grip)).toBe(0)
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
