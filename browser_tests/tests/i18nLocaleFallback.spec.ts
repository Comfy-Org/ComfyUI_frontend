import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

// Regression test for https://github.com/Comfy-Org/ComfyUI_frontend/issues/10563
//
// Pins the end-to-end cascade through createI18n + coreSettings defaultValue +
// GraphView watchEffect: when navigator.language base tag is unsupported (e.g.
// 'de-DE') and Comfy.Locale is unset (fresh-install state), sidebar labels
// must render translated strings, not literal i18n keys like
// 'sideToolbar.labels.assets'.
test.describe('i18n locale fallback', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        value: 'de-DE',
        configurable: true
      })
      Object.defineProperty(navigator, 'languages', {
        value: ['de-DE', 'de'],
        configurable: true
      })
    })
    // Default sidebar size on small viewports hides labels; force normal so
    // .side-bar-button-label is rendered for the assertion.
    await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
    await comfyPage.page.reload()
    await comfyPage.waitForAppReady()
  })

  test('sidebar labels render translated strings, not raw i18n keys', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    await page.setViewportSize({ width: 1920, height: 1080 })

    const labelTexts = await page
      .getByTestId('side-toolbar')
      .locator('.side-bar-button-label')
      .allTextContents()

    expect(labelTexts.length).toBeGreaterThan(0)
    for (const text of labelTexts) {
      expect(text).not.toContain('sideToolbar.labels')
    }
  })
})
