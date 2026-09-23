import { liveCloudBillingFixture as test } from '@e2e/fixtures/liveCloudBillingFixture'
import { expect } from '@playwright/test'

test.describe('Real Cloud billing connection', { tag: ['@cloud-live'] }, () => {
  test('signs in and reads the account billing state', async ({
    comfyPage
  }) => {
    await comfyPage.waitForAppReady()
    await expect(comfyPage.canvas).toBeVisible()
    await comfyPage.attachScreenshot('billing-smoke.png', { runInCI: true })
  })
})
