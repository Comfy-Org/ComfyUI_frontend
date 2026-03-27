import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Text size token rename regression', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)

    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
  })

  test('NodePreviewCard renders inputs and outputs on hover', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.getFolder('sampling').click()

    const leaf = tab.nodeLibraryTree.getByTestId('node-tree-leaf').first()
    await leaf.hover()

    await expect(tab.nodePreview).toBeVisible()
    await expect(
      tab.nodePreview.getByText('INPUTS', { exact: true })
    ).toBeVisible()
    await expect(
      tab.nodePreview.getByText('OUTPUTS', { exact: true })
    ).toBeVisible()
  })
})
