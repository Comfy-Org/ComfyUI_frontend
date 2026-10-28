import { mergeTests } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const ACCOUNT_DELETION_FORM_URL =
  'https://comfysupport.portal.usepylon.com/forms/request-account-deletion'

/**
 * Boots with the host telemetry sink enabled and the Pylon deletion form
 * stubbed, so a spec can read the click event and the opened form URL.
 */
export const accountDeletionTest = mergeTests(
  comfyPageFixture,
  hostTelemetryFixture
).extend({
  page: async ({ page }, use) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({ enable_telemetry: true } satisfies RemoteConfig)
      )
    )
    await page
      .context()
      .route(`${ACCOUNT_DELETION_FORM_URL}**`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
      )
    await use(page)
  }
})
