import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Settings } from '@/platform/settings/types'

test.use({
  initialSettings: {
    'Comfy.Extension.DisabledPacks': ['/extensions/agent-cushions/']
  }
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      json: {
        'Comfy.Extension.DisabledPacks': ['/extensions/agent-cushions/']
      } satisfies Partial<Settings>
    })
  })
  await page.route('**/extensions', (route) =>
    route.fulfill({
      json: ['/extensions/agent-cushions/main.js']
    })
  )
  await page.route('**/extensions/agent-cushions/main.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "document.body.style.opacity = '0.2'"
    })
  )
})

test.describe(
  'Extension pack import gate',
  { tag: ['@settings', '@canvas'] },
  () => {
    test("does not apply a disabled pack's top-level visual side effects", async ({
      comfyPage,
      page
    }) => {
      await expect(comfyPage.canvas).toBeVisible()
      expect(
        await comfyPage.settings.getSetting('Comfy.Extension.DisabledPacks')
      ).toEqual(['/extensions/agent-cushions/'])
      await expect(page.locator('body')).toHaveCSS('opacity', '1')
    })
  }
)
