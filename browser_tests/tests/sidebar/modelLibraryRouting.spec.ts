import { expect, mergeTests } from '@playwright/test'

import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

const test = mergeTests(comfyPageFixture, assetApiFixture)

const assetBrowserModal = '[data-component-id="AssetBrowserModal"]'

test.describe('Model library tab routing', () => {
  test('Opens the asset browser when the assets capability and browser setting are enabled', async ({
    comfyPage,
    assetApi
  }) => {
    await assetApi.mock()
    await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
    await comfyPage.settings.setSetting(
      'Comfy.ModelLibrary.UseAssetBrowser',
      true
    )

    await comfyPage.menu.modelLibraryTab.tabButton.click()

    await expect(comfyPage.page.locator(assetBrowserModal)).toBeVisible()
    await expect(comfyPage.menu.modelLibraryTab.modelTree).toHaveCount(0)
  })

  test('Keeps the sidebar tree when the assets capability is disabled', async ({
    comfyPage
  }) => {
    await comfyPage.featureFlags.setServerFlagsPersistent({ assets: false })
    await comfyPage.settings.setSetting(
      'Comfy.ModelLibrary.UseAssetBrowser',
      true
    )

    await comfyPage.menu.modelLibraryTab.open()

    await expect(comfyPage.menu.modelLibraryTab.modelTree).toBeVisible()
    await expect(comfyPage.page.locator(assetBrowserModal)).toHaveCount(0)
  })

  test('Keeps the sidebar tree when only the assets capability is enabled', async ({
    comfyPage,
    assetApi
  }) => {
    await assetApi.mock()
    await comfyPage.featureFlags.setServerFlagsPersistent({ assets: true })
    await comfyPage.settings.setSetting(
      'Comfy.ModelLibrary.UseAssetBrowser',
      false
    )

    await comfyPage.menu.modelLibraryTab.open()

    await expect(comfyPage.menu.modelLibraryTab.modelTree).toBeVisible()
    await expect(comfyPage.page.locator(assetBrowserModal)).toHaveCount(0)
  })
})

test.describe('Model library tab routing on cloud', { tag: '@cloud' }, () => {
  test('Defaults to the asset browser', async ({ comfyPage, assetApi }) => {
    await assetApi.mock()

    await comfyPage.menu.modelLibraryTab.tabButton.click()

    // Assert the default itself, not only the routing result.
    await expect
      .poll(() =>
        comfyPage.settings.getSetting('Comfy.ModelLibrary.UseAssetBrowser')
      )
      .toBe(true)
    await expect(comfyPage.page.locator(assetBrowserModal)).toBeVisible()
    await expect(comfyPage.menu.modelLibraryTab.modelTree).toHaveCount(0)
  })
})
