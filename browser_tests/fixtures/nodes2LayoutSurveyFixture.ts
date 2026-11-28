import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

export const layoutSurveyTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const local = new URL(
      process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    ).origin
    await page.context().route(
      (url) =>
        url.origin !== local &&
        (url.protocol === 'http:' || url.protocol === 'https:'),
      (route) => route.fulfill({ status: 204, body: '' })
    )
    await page.route('**/manager/badge_mode', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'none' })
    )
    await use(page)
  }
})
