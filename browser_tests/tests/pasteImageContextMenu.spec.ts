import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Paste Image context menu option', { tag: ['@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('shows Paste Image in LoadImage node context menu after image is loaded', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y },
      waitForUpload: true
    })

    const menuOptions = await loadImageNode.getContextMenuOptionNames()

    expect(menuOptions).toContain('Paste Image')

    const copyIdx = menuOptions.indexOf('Copy Image')
    const pasteIdx = menuOptions.indexOf('Paste Image')
    const saveIdx = menuOptions.indexOf('Save Image')
    expect(copyIdx).toBeLessThan(pasteIdx)
    expect(pasteIdx).toBeLessThan(saveIdx)
  })

  test('does not show Paste Image on output-only image nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_save_image_node')

    const saveImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('SaveImage')
    )[0]

    const menuOptions = await saveImageNode.getContextMenuOptionNames()

    expect(menuOptions).not.toContain('Paste Image')
  })
})
