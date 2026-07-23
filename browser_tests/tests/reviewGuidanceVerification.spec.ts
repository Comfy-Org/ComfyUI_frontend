import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Review guidance verification', () => {
  test('shows the canvas', async ({ comfyPage }) => {
    await expect(comfyPage.canvas).toBeVisible()
  })
})
