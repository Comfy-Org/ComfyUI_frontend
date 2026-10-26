import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.use({
  initialSettings: {
    'Comfy.Extension.DisabledPacks': ['/extensions/agent-cushions/']
  }
})

let packRequested = false

test.beforeEach(async ({ page }) => {
  packRequested = false
  await page.route('**/extensions', (route) =>
    route.fulfill({
      json: ['/extensions/agent-cushions/main.js']
    })
  )
  await page.route('**/extensions/agent-cushions/main.js*', (route) => {
    packRequested = true
    return route.fulfill({
      contentType: 'text/javascript',
      body: "document.body.style.opacity = '0.2'"
    })
  })
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
      await expect(page.locator('body')).toHaveCSS('opacity', '1')
      expect(packRequested).toBe(false)
    })
  }
)
