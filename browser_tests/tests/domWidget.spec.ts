import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('DOM Widget', () => {
  test('Collapsed multiline textarea is not visible', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/collapsed_multiline')
    const textareaWidget = comfyPage.page.locator('.comfy-multiline-input')
    await expect(textareaWidget).not.toBeVisible()
  })

  test('Multiline textarea correctly collapses', async ({ comfyPage }) => {
    const multilineTextAreas = comfyPage.page.locator('.comfy-multiline-input')
    const firstMultiline = multilineTextAreas.first()
    const lastMultiline = multilineTextAreas.last()

    await expect(firstMultiline).toBeVisible()
    await expect(lastMultiline).toBeVisible()

    const nodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
    for (const node of nodes) {
      await node.click('collapse')
    }
    await expect(firstMultiline).not.toBeVisible()
    await expect(lastMultiline).not.toBeVisible()
  })

  test('Position update when entering focus mode', async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.executeCommand('Workspace.ToggleFocusMode')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot('focus-mode-on.png')
  })

  // No DOM widget should be created by creation of interim LGraphNode objects.
  test('Copy node with DOM widget by dragging + alt', async ({ comfyPage }) => {
    const initialCount = await comfyPage.getDOMWidgetCount()

    // TextEncodeNode1
    await comfyPage.page.mouse.move(618, 191)
    await comfyPage.page.keyboard.down('Alt')
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.page.mouse.up()
    await comfyPage.page.keyboard.up('Alt')

    const finalCount = await comfyPage.getDOMWidgetCount()
    expect(finalCount).toBe(initialCount + 1)
  })

  test('should reposition when layout changes', async ({ comfyPage }) => {
    // --- setup ---

    const textareaWidget = comfyPage.page
      .locator('.comfy-multiline-input')
      .first()
    await expect(textareaWidget).toBeVisible()

    await comfyPage.setSetting('Comfy.Sidebar.Size', 'small')
    await comfyPage.setSetting('Comfy.Sidebar.Location', 'left')
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.nextFrame()

    let oldPos: [number, number]
    const checkBboxChange = async () => {
      const boudningBox = (await textareaWidget.boundingBox())!
      expect(boudningBox).not.toBeNull()
      const position: [number, number] = [boudningBox.x, boudningBox.y]
      expect(position).not.toEqual(oldPos)
      oldPos = position
    }
    await checkBboxChange()

    // --- test ---

    await comfyPage.setSetting('Comfy.Sidebar.Size', 'normal')
    await comfyPage.nextFrame()
    await checkBboxChange()

    await comfyPage.setSetting('Comfy.Sidebar.Location', 'right')
    await comfyPage.nextFrame()
    await checkBboxChange()

    await comfyPage.setSetting('Comfy.UseNewMenu', 'Bottom')
    await comfyPage.nextFrame()
    await checkBboxChange()
  })
})
