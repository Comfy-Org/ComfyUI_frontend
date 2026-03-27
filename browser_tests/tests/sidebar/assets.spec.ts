import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

async function openAssetsSidebar(
  comfyPage: ComfyPage,
  seed: Parameters<ComfyPage['assets']['seedAssets']>[0]
) {
  await comfyPage.page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: comfyPage.url
    })
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.assets.seedAssets(seed)

  const tab = comfyPage.menu.assetsTab
  await tab.open()

  return tab
}

test.describe('Assets sidebar', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('shows empty-state copy for generated and imported tabs', async ({
    comfyPage
  }) => {
    const tab = await openAssetsSidebar(comfyPage, {
      generated: [],
      imported: []
    })

    await expect(tab.emptyStateTitle('No generated files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()

    await tab.showImported()

    await expect(tab.emptyStateTitle('No imported files found')).toBeVisible()
    await expect(tab.emptyStateMessage).toBeVisible()
  })
})
