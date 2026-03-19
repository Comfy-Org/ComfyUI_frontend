import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Vue Node Drag Snapping', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.canvasOps.resetView()
    await comfyPage.vueNodes.waitForNodes(6)
  })

  test('snaps a dragged node to another node in Vue nodes mode', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Canvas.AlignNodesWhileDragging',
      true
    )

    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
    const checkpointNode = comfyPage.vueNodes
      .getNodeByTitle('Load Checkpoint')
      .first()
    const ksamplerHeader = ksamplerNode.locator('.lg-node-header')

    const ksamplerBox = await ksamplerNode.boundingBox()
    const checkpointBox = await checkpointNode.boundingBox()
    const headerBox = await ksamplerHeader.boundingBox()

    if (!ksamplerBox || !checkpointBox || !headerBox) {
      throw new Error('Expected Vue node bounding boxes to be available')
    }

    const dragStart = {
      x: headerBox.x + headerBox.width / 2,
      y: headerBox.y + headerBox.height / 2
    }
    const targetLeft = checkpointBox.x + 5
    const dragTarget = {
      x: dragStart.x + (targetLeft - ksamplerBox.x),
      y: dragStart.y
    }

    await comfyPage.canvasOps.dragAndDrop(dragStart, dragTarget)

    await expect
      .poll(async () => {
        const draggedBox = await ksamplerNode.boundingBox()
        return draggedBox ? Math.round(draggedBox.x) : null
      })
      .toBe(Math.round(checkpointBox.x))
  })
})
