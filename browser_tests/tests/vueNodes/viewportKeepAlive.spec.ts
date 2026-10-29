import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue node viewport KeepAlive',
  { tag: ['@canvas', '@node', '@vue-nodes', '@slow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('large-graph-workflow')
      await comfyPage.canvasOps.setScale(1)
      await comfyPage.canvasOps.setOffset([0, 0])
    })

    test('detaches nodes and restores the same element without changing graph size', async ({
      comfyPage
    }) => {
      const initialNode = comfyPage.vueNodes.nodes.first()
      await expect(initialNode).toBeVisible()
      const nodeId = await initialNode.getAttribute('data-node-id')
      const initialElement = await initialNode.elementHandle()
      if (!nodeId) {
        throw new Error('Expected an active Vue node with an id')
      }
      const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
      const initialSize = await node.getSize()

      await comfyPage.canvasOps.setOffset([-100_000, 0])

      await expect
        .poll(() => initialElement.evaluate((element) => element.isConnected))
        .toBe(false)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeCount())
        .toBeLessThan(245)

      await comfyPage.canvasOps.setOffset([0, 0])

      const returnedNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(returnedNode).toBeVisible()
      const returnedElement = await returnedNode.elementHandle()

      expect(
        await initialElement.evaluate(
          (element, candidate) => element === candidate,
          returnedElement
        )
      ).toBe(true)
      expect(await node.getSize()).toEqual(initialSize)
    })

    test('keeps the focused node connected while panning away', async ({
      comfyPage
    }) => {
      const focusedNode = comfyPage.vueNodes.nodes.first()
      const focusedElement = await focusedNode.elementHandle()
      const unpinnedNode = comfyPage.vueNodes.nodes.nth(1)
      await expect(unpinnedNode).toBeVisible()
      const unpinnedElement = await unpinnedNode.elementHandle()
      await focusedNode.focus()

      await comfyPage.canvasOps.setOffset([-100_000, 0])

      await expect
        .poll(() => unpinnedElement.evaluate((element) => element.isConnected))
        .toBe(false)
      expect(
        await focusedElement.evaluate((element) => element.isConnected)
      ).toBe(true)
      expect(
        await focusedElement.evaluate((element) =>
          element.contains(document.activeElement)
        )
      ).toBe(true)
    })

    test('keeps a link-drag source connected while panning away', async ({
      comfyPage
    }) => {
      const sourceNode = comfyPage.vueNodes.getNodeLocator('3')
      const outputSlot = comfyPage.vueNodes.getOutputSlotConnectionDot('3', 0)
      await expect(outputSlot).toBeVisible()
      const sourceElement = await sourceNode.elementHandle()

      await outputSlot.hover()
      await comfyPage.page.mouse.down()
      try {
        await test.step('Start a link drag without focus or selection pins', async () => {
          await comfyPage.page.evaluate(() => {
            window.app!.canvas.deselectAll()
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
          })
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                () => window.app!.canvas.linkConnector.isConnecting
              )
            )
            .toBe(true)
        })

        await test.step('Cull offscreen nodes while retaining the drag source', async () => {
          await comfyPage.canvasOps.setOffset([-100_000, 0])
          await expect
            .poll(() => comfyPage.vueNodes.getNodeCount())
            .toBeLessThan(245)
          await expect
            .poll(() =>
              sourceElement.evaluate((element) => element.isConnected)
            )
            .toBe(true)
        })

        await comfyPage.canvas.press('Escape')
      } finally {
        await comfyPage.page.mouse.up()
      }

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.canvas.linkConnector.isConnecting
          )
        )
        .toBe(false)
      await expect
        .poll(() => sourceElement.evaluate((element) => element.isConnected))
        .toBe(false)
    })
  }
)
