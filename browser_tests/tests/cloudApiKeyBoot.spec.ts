import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const API_KEY = 'comfyui-e2e-cloud-api-key'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.route('**/customers', (route) => {
      const request = route.request()
      if (request.method() !== 'POST') return route.fallback()
      if (request.headers()['x-api-key'] !== API_KEY) {
        return route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
      }
      return route.fulfill({ status: 201, json: { id: 'api-key-owner' } })
    })
    await use(page)
  }
})

test.describe('Cloud boot on an API-key session', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.use({
    firebaseLogin: false,
    initialLocalStorage: { comfy_api_key: API_KEY }
  })

  test('an API-key-only session boots into a usable app', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await expect(page.getByTestId(TestIds.app.loadingOverlay)).toBeHidden()
    expect(page.url()).not.toContain('/cloud/login')
    expect(
      await page.evaluate(() => localStorage.getItem('comfy_api_key')),
      'the key stays the login instead of being rejected'
    ).toBe(API_KEY)
  })
})
