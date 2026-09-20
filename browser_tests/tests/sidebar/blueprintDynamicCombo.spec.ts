import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { dynamicComboBlueprints } from '@e2e/fixtures/data/blueprintDynamicCombo'

test.describe('Blueprint dynamic combo preview', { tag: '@ui' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/global_subgraphs', async (route) => {
      await route.fulfill({ json: dynamicComboBlueprints })
    })
  })

  test('renders an options-free boundary input without an assertion', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await tab.allTab.click()
    await tab.expandFolder('Comfy Blueprints')
    await tab.getNode('Dynamic combo blueprint').hover()
    await expect(tab.nodePreview).toBeVisible()
    await expect(
      tab.nodePreview.getByText('boundary_model', { exact: true })
    ).toBeVisible()
    await expect(
      tab.nodePreview.getByText('COMFY_DYNAMICCOMBO_V3', { exact: true })
    ).toBeVisible()
    expect(await comfyPage.page.pageErrors()).toEqual([])
  })
})
