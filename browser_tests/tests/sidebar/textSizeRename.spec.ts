import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe(
  'Text size token rename regression',
  { tag: ['@screenshot', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)

      const tab = comfyPage.menu.nodeLibraryTab
      await tab.open()
    })

    test('NodePreviewCard renders text-2xs correctly on hover', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()

      await comfyPage.page.hover('.p-tree-node-leaf')

      await expect(tab.nodePreview).toBeVisible()
      await expect(tab.nodePreview).toHaveScreenshot(
        'node-preview-card-text-2xs.png'
      )
    })
  }
)
