import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../../fixtures/ComfyPage'

async function getNodeHeader(comfyPage: ComfyPage, title: string) {
  const node = comfyPage.vueNodes.getNodeByTitle(title).first()
  await expect(node).toBeVisible()
  return node.locator('.lg-node-header')
}

async function selectTwoNodes(comfyPage: ComfyPage) {
  const checkpointHeader = await getNodeHeader(comfyPage, 'Load Checkpoint')
  const ksamplerHeader = await getNodeHeader(comfyPage, 'KSampler')

  await checkpointHeader.click()
  await ksamplerHeader.click({ modifiers: ['Control'] })
  await comfyPage.nextFrame()
}

test.describe('Vue Node Alignment', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
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

  test('shows center alignment actions from the multi-node right-click menu', async ({
    comfyPage
  }) => {
    await selectTwoNodes(comfyPage)

    const ksamplerHeader = await getNodeHeader(comfyPage, 'KSampler')
    await ksamplerHeader.click({ button: 'right' })

    const alignMenuItem = comfyPage.page.getByText('Align Selected To', {
      exact: true
    })
    await expect(alignMenuItem).toBeVisible()
    await alignMenuItem.hover()

    await expect(
      comfyPage.page.getByText('Horizontal Center', { exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByText('Vertical Center', { exact: true })
    ).toBeVisible()
  })

  test('does not show alignment actions from the selection toolbox More Options menu', async ({
    comfyPage
  }) => {
    await selectTwoNodes(comfyPage)
    await expect(comfyPage.selectionToolbox).toBeVisible()

    await comfyPage.page.click('[data-testid="more-options-button"]')

    await expect(
      comfyPage.page.getByText('Rename', { exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByText('Align Selected To', { exact: true })
    ).not.toBeVisible()
  })
})
