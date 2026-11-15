import type { GetExtensionsResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.use({
  initialSettings: {
    'Comfy.Extension.DisabledPacks': ['/extensions/agent-cushions/']
  }
})

test.beforeEach(async ({ page }) => {
  await page.route('**/extensions', (route) =>
    route.fulfill({
      json: [
        '/extensions/agent-cushions/main.js'
      ] satisfies GetExtensionsResponse
    })
  )
  await page.route('**/extensions/agent-cushions/main.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "document.body.style.opacity = '0.2'"
    })
  )
})

test.describe('Extension import gate', { tag: ['@ui', '@canvas'] }, () => {
  test("does not apply a disabled extension's top-level visual side effects", async ({
    comfyPage,
    page
  }) => {
    await expect(comfyPage.canvas).toBeVisible()
    expect(
      await comfyPage.settings.getSetting('Comfy.Extension.DisabledPacks')
    ).toEqual(['/extensions/agent-cushions/'])
    await expect(page.locator('body')).toHaveCSS('opacity', '1')
  })
})
