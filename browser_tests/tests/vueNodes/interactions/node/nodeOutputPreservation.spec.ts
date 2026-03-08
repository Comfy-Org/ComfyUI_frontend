import { expect } from '@playwright/test'

import type { ComfyPage } from '../../../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'

test.describe('Node Output Preservation', { tag: ['@widget', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  async function loadImageOnNode(comfyPage: ComfyPage) {
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

    return { imagePreview }
  }

  async function getTab(comfyPage: ComfyPage, index: number) {
    return comfyPage.page.locator('.workflow-tabs .p-togglebutton').nth(index)
  }

  test('LoadImage preview survives tab switch', async ({ comfyPage }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    // Create a new tab (switches to it)
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()

    // Switch back to the first tab
    const firstTab = await getTab(comfyPage, 0)
    await firstTab.click()
    await comfyPage.nextFrame()

    // Image preview should still be visible
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
  })

  test('LoadImage preview survives execution + tab switch', async ({
    comfyPage
  }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    // Queue a prompt and wait for execution to complete
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
    await comfyPage.nextFrame()

    // Create a new tab
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()

    // Switch back to the first tab
    const firstTab = await getTab(comfyPage, 0)
    await firstTab.click()
    await comfyPage.nextFrame()

    // Image preview should still be visible
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
  })

  test('Multiple LoadImage nodes on different tabs preserve independently', async ({
    comfyPage
  }) => {
    // Tab 1: Load image on a LoadImage node
    await loadImageOnNode(comfyPage)
    const tab1Preview = comfyPage.page.locator('.image-preview img')
    await expect(tab1Preview).toBeVisible()

    // Create Tab 2 and load a different workflow with LoadImage
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.nextFrame()
    await loadImageOnNode(comfyPage)
    const tab2Preview = comfyPage.page.locator('.image-preview img')
    await expect(tab2Preview).toBeVisible()

    // Switch to Tab 1 — its preview should be visible
    const firstTab = await getTab(comfyPage, 0)
    await firstTab.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.page.locator('.image-preview img')).toBeVisible()

    // Switch to Tab 2 — its preview should be visible
    const secondTab = await getTab(comfyPage, 1)
    await secondTab.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.page.locator('.image-preview img')).toBeVisible()
  })
})
