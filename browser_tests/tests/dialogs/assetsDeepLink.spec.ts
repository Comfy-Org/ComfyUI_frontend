import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'

/**
 * The `?assets=1` deep link opens the Assets sidebar panel on app load, so
 * comfy.org can send a visitor from a saved generation to the library holding
 * the rest. Drives a raw `page` so the cloud app boots against fully mocked
 * endpoints, like the top-up and pricing-table deep-link specs.
 */
test.describe('Assets deep link', { tag: '@cloud' }, () => {
  test('opens the Assets panel and strips the param', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    const assetsTab = new SidebarTab(page, 'assets')

    await page.goto(`${APP_URL}/?assets=1`)

    await expect(assetsTab.selectedTabButton).toBeVisible({
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/[?&]assets=/)
  })

  test('strips an unrecognised value without opening the panel', async ({
    page
  }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    const assetsTab = new SidebarTab(page, 'assets')

    await page.goto(`${APP_URL}/?assets=garbage`)

    await page.waitForURL((url) => !url.searchParams.has('assets'), {
      timeout: 45_000
    })
    await expect(assetsTab.selectedTabButton).toBeHidden()
  })

  test('strips both params when two deep links arrive together', async ({
    page
  }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })
    const assetsTab = new SidebarTab(page, 'assets')

    await page.goto(`${APP_URL}/?settings=plan-credits&assets=1`)

    await expect(assetsTab.selectedTabButton).toBeVisible({
      timeout: 45_000
    })
    // Each loader waits for its own strip to land. Without that, the assets
    // loader reads a query the settings loader has not cleaned yet and writes
    // `settings` back into the URL.
    await expect(page).not.toHaveURL(/[?&]settings=/)
    await expect(page).not.toHaveURL(/[?&]assets=/)
  })
})
