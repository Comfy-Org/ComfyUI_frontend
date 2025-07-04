import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Release Notifications', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('should show help center with release information', async ({
    comfyPage
  }) => {
    // Mock release API with test data instead of empty array
    await comfyPage.page.route('**/releases**', async (route) => {
      const url = route.request().url()
      if (
        url.includes('api.comfy.org') ||
        url.includes('stagingapi.comfy.org')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              project: 'comfyui',
              version: 'v0.3.44',
              attention: 'medium',
              content:
                '## New Features\n\n- Added awesome feature\n- Fixed important bug',
              published_at: new Date().toISOString()
            }
          ])
        })
      } else {
        await route.continue()
      }
    })

    // Setup with release mocking disabled for this test
    await comfyPage.setup({ mockReleases: false })

    // Open help center
    const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
    await helpCenterButton.waitFor({ state: 'visible' })
    await helpCenterButton.click()

    // Verify help center menu appears
    const helpMenu = comfyPage.page.locator('.help-center-menu')
    await expect(helpMenu).toBeVisible()

    // Verify "What's New?" section shows the release
    const whatsNewSection = comfyPage.page.locator('.whats-new-section')
    await expect(whatsNewSection).toBeVisible()

    // Should show the release version
    await expect(
      whatsNewSection.locator('text=Comfy v0.3.44 Release')
    ).toBeVisible()

    // Close help center by dismissable mask
    await comfyPage.page.click('.help-center-backdrop')
    await expect(helpMenu).not.toBeVisible()
  })

  test('should not show release notifications when mocked (default behavior)', async ({
    comfyPage
  }) => {
    // Use default setup (mockReleases: true)
    await comfyPage.setup()

    // Open help center
    const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
    await helpCenterButton.waitFor({ state: 'visible' })
    await helpCenterButton.click()

    // Verify help center menu appears
    const helpMenu = comfyPage.page.locator('.help-center-menu')
    await expect(helpMenu).toBeVisible()

    // Verify "What's New?" section shows no releases
    const whatsNewSection = comfyPage.page.locator('.whats-new-section')
    await expect(whatsNewSection).toBeVisible()

    // Should show "No recent releases" message
    await expect(
      whatsNewSection.locator('text=No recent releases')
    ).toBeVisible()

    // Should not show any popups or toasts
    await expect(comfyPage.page.locator('.whats-new-popup')).not.toBeVisible()
    await expect(
      comfyPage.page.locator('.release-notification-toast')
    ).not.toBeVisible()
  })

  test('should handle release API errors gracefully', async ({ comfyPage }) => {
    // Mock API to return an error
    await comfyPage.page.route('**/releases**', async (route) => {
      const url = route.request().url()
      if (
        url.includes('api.comfy.org') ||
        url.includes('stagingapi.comfy.org')
      ) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        })
      } else {
        await route.continue()
      }
    })

    // Setup with release mocking disabled
    await comfyPage.setup({ mockReleases: false })

    // Open help center
    const helpCenterButton = comfyPage.page.locator('.comfy-help-center-btn')
    await helpCenterButton.waitFor({ state: 'visible' })
    await helpCenterButton.click()

    // Verify help center still works despite API error
    const helpMenu = comfyPage.page.locator('.help-center-menu')
    await expect(helpMenu).toBeVisible()

    // Should show no releases due to error
    const whatsNewSection = comfyPage.page.locator('.whats-new-section')
    await expect(
      whatsNewSection.locator('text=No recent releases')
    ).toBeVisible()
  })
})
