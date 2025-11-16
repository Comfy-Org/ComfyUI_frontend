/**
 * @cloud
 * Cloud E2E tests.
 * Tests run against stagingcloud.comfy.org with authenticated user.
 */

import { expect } from '@playwright/test'

import { comfyPageCloudFixture as test } from '../fixtures/ComfyPageCloud'

test.describe('Cloud E2E @cloud', () => {
  test('loads app with authentication', async ({ comfyPage }) => {
    // App should be loaded from setup()
    await expect(comfyPage.canvas).toBeVisible()

    // Verify we're authenticated (cloud-specific check)
    const isAuthenticated = await comfyPage.page.evaluate(() => {
      // Check for Firebase auth in localStorage
      const keys = Object.keys(localStorage)
      return keys.some(
        (key) => key.startsWith('firebase:') || key.includes('authUser')
      )
    })
    expect(isAuthenticated).toBe(true)
  })

  test('can interact with canvas', async ({ comfyPage }) => {
    // Basic canvas interaction
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toBeVisible()

    // Close search box
    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.searchBox.input).not.toBeVisible()
  })

  test('can access settings dialog', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.click('button[data-testid="settings-button"]', {
      timeout: 10000
    })

    // Settings dialog should be visible
    await expect(comfyPage.page.locator('.p-dialog')).toBeVisible()

    // Close settings
    await comfyPage.closeDialog()
  })
})
