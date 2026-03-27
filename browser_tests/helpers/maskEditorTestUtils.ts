import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

export async function loadImageOnNode(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
  await comfyPage.vueNodes.waitForNodes()

  const loadImageNode = (
    await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
  )[0]
  const { x, y } = await loadImageNode.getPosition()

  await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
    dropPosition: { x, y }
  })

  const imagePreview = comfyPage.page.locator('.image-preview')
  await expect(imagePreview).toBeVisible()
  await expect(imagePreview.locator('img')).toBeVisible()
  await expect(imagePreview).toContainText('x')

  return {
    imagePreview,
    nodeId: String(loadImageNode.id)
  }
}

export async function openMaskEditorViaCommand(comfyPage: ComfyPage) {
  const { nodeId } = await loadImageOnNode(comfyPage)
  await comfyPage.vueNodes.selectNode(nodeId)
  await comfyPage.command.executeCommand('Comfy.MaskEditor.OpenMaskEditor')
  return comfyPage.page.getByTestId(TestIds.maskEditor.dialog)
}
