import { expect } from '@playwright/test'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

test.describe('Topbar badges', { tag: ['@cloud', '@ui'] }, () => {
  test('hides a duplicate PREVIEW label at compact width', async ({ page }) => {
    await page.setViewportSize({ width: 1243, height: 963 })
    await mockCloudBoot(page, {
      features: {
        server_health_alert: {
          message: 'PREVIEW ENVIRONMENT',
          badge: 'PREVIEW',
          severity: 'warning'
        }
      },
      settings: { 'Comfy.TutorialCompleted': true }
    })
    await bootCloud(page)
    await page.goto(APP_URL)
    await waitForCloudApp(page)

    await expect(page.getByTestId('badge-icon')).toBeVisible()
    await expect(page.getByText('PREVIEW', { exact: true })).toHaveCount(0)
  })
})
