import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('DOM Widget', { tag: '@widget' }, () => {
  test('Collapsed multiline textarea is not visible', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/collapsed_multiline')
    const textareaWidget = comfyPage.page.locator('.comfy-multiline-input')
    await expect(textareaWidget).toBeHidden()
  })

  test('Multiline textarea correctly collapses', async ({ comfyPage }) => {
    const multilineTextAreas = comfyPage.page.locator('.comfy-multiline-input')
    const firstMultiline = multilineTextAreas.first()
    const lastMultiline = multilineTextAreas.last()

    await expect(firstMultiline).toBeVisible()
    await expect(lastMultiline).toBeVisible()

    const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    for (const node of nodes) {
      await node.click('collapse')
    }
    await expect(firstMultiline).toBeHidden()
    await expect(lastMultiline).toBeHidden()
  })

  test(
    'Position update when entering focus mode',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.command.executeCommand('Workspace.ToggleFocusMode')
      await expect(comfyPage.menu.sideToolbar).toBeHidden()
      await expect(comfyPage.canvas).toHaveScreenshot('focus-mode-on.png')
    }
  )

  // No DOM widget should be created by creation of interim LGraphNode objects.
  test('Copy node with DOM widget by dragging + alt', async ({ comfyPage }) => {
    const initialCount = await comfyPage.domWidgets.count()

    // TextEncodeNode1
    await comfyPage.page.mouse.move(618, 191)
    await comfyPage.page.keyboard.down('Alt')
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.page.mouse.up()
    await comfyPage.page.keyboard.up('Alt')

    await expect(comfyPage.domWidgets).toHaveCount(initialCount + 1)
  })
})
