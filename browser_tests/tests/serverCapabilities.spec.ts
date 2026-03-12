import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Server Capabilities Resilience', { tag: '@slow' }, () => {
  test('App starts successfully when /api/features returns 500', async ({
    comfyPage
  }) => {
    await comfyPage.page.route('**/api/features**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })
    await comfyPage.setup()

    await expect(comfyPage.canvas).toBeVisible()
  })

  test('App starts successfully when /api/features network request fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.route('**/api/features**', async (route) => {
      await route.abort('connectionrefused')
    })
    await comfyPage.setup()

    await expect(comfyPage.canvas).toBeVisible()
  })
})
