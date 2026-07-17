import { expect, mergeTests } from '@playwright/test'

import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

const test = mergeTests(comfyPageFixture, assetApiFixture)

const assetBrowserModal = '[data-component-id="AssetBrowserModal"]'

test.describe('Model library tab routing', () => {
  test('Opens the asset browser when both asset settings are enabled', async ({
    comfyPage,
    assetApi
  }) => {
    await assetApi.mock()
    await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
    await comfyPage.settings.setSetting(
      'Comfy.ModelLibrary.UseAssetBrowser',
      true
    )

    await comfyPage.menu.modelLibraryTab.tabButton.click()

    await expect(comfyPage.page.locator(assetBrowserModal)).toBeVisible()
    await expect(comfyPage.menu.modelLibraryTab.modelTree).toHaveCount(0)
  })

  test('Keeps the sidebar tree when the asset API is disabled', async ({
    comfyPage
  }) => {
    // With the asset API off, the browser setting is inert.
    await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', false)
    await comfyPage.settings.setSetting(
      'Comfy.ModelLibrary.UseAssetBrowser',
      true
    )

    await comfyPage.menu.modelLibraryTab.open()

    await expect(comfyPage.menu.modelLibraryTab.modelTree).toBeVisible()
    await expect(comfyPage.page.locator(assetBrowserModal)).toHaveCount(0)
  })

  test('Keeps the sidebar tree when only the asset API is enabled', async ({
    comfyPage,
    assetApi
  }) => {
    await assetApi.mock()
    await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
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
    // Cloud defaults both asset settings on; no explicit settings here so the
    // test pins the defaults, not just the routing.
    await assetApi.mock()

    await comfyPage.menu.modelLibraryTab.tabButton.click()

    // Assert the defaults themselves, not only the routing result.
    expect(await comfyPage.settings.getSetting('Comfy.Assets.UseAssetAPI')).toBe(
      true
    )
    expect(
      await comfyPage.settings.getSetting('Comfy.ModelLibrary.UseAssetBrowser')
    ).toBe(true)
    await expect(comfyPage.page.locator(assetBrowserModal)).toBeVisible()
    await expect(comfyPage.menu.modelLibraryTab.modelTree).toHaveCount(0)
  })
})
