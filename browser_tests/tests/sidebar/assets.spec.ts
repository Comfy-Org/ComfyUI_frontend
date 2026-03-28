import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Assets sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockEmptyState()
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Shows empty-state copy for generated and imported tabs', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab

    await tab.open()

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()

    await tab.importedTab.click()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })
})
