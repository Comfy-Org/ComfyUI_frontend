import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Slot Auto Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.settings.setSetting(
      'Comfy.Node.MiddleClickRerouteNode',
      true
    )
    await comfyPage.nextFrame()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Node.MiddleClickRerouteNode',
      false
    )
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test('Middle-click on output slot should create default node', async ({
    comfyPage
  }) => {
    const [nodeRef] =
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    expect(
      nodeRef,
      'Expected CLIPTextEncode node in default workflow'
    ).toBeTruthy()

    if (!nodeRef)
      throw new Error('Expected CLIPTextEncode node in default workflow')

    const slotPos = await comfyPage.page.evaluate((targetNodeId) => {
      const node = window.app!.graph!.getNodeById(targetNodeId)
      if (!node) return null
      const pos = node.getConnectionPos(false, 0)
      return window.app!.canvasPosToClientPos(pos)
    }, nodeRef.id)
    if (!slotPos) throw new Error('Could not resolve output slot position')

    const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.page.mouse.click(slotPos[0], slotPos[1], {
      button: 'middle'
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBeGreaterThan(initialNodeCount)
  })
})
