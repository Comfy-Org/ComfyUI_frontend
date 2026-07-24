import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Mirrors BANNER_DISMISS_DELAY_MS in src/composables/queue/useQueueNotificationBanners.ts.
// Duplicated here to avoid pulling production source (and its litegraph
// transitive deps) into the Playwright TS loader.
const BANNER_DISMISS_DELAY_MS = 4000
const BANNER_ASSERT_TIMEOUT_MS = BANNER_DISMISS_DELAY_MS + 2000

const REQUEST_ID_PRIMARY = 1
const REQUEST_ID_SECONDARY = 2
const REQUEST_ID_MISMATCH = 999

let nextRequestId = 1000
const newRequestId = () => nextRequestId++

function bannerLocator(page: Page) {
  return page.getByTestId(TestIds.queue.notificationBanner)
}

type DispatchOpts = { batchCount?: number; requestId?: number }

function dispatchPromptQueueing(page: Page, opts: DispatchOpts = {}) {
  return page.evaluate(
    ([batchCount, requestId]) => {
      window.app!.api.dispatchCustomEvent('promptQueueing', {
        batchCount,
        requestId
      })
    },
    [opts.batchCount ?? 1, opts.requestId ?? newRequestId()]
  )
}

function dispatchPromptQueued(page: Page, opts: DispatchOpts = {}) {
  return page.evaluate(
    ([batchCount, requestId]) => {
      window.app!.api.dispatchCustomEvent('promptQueued', {
        number: 0,
        batchCount,
        requestId
      })
    },
    [opts.batchCount ?? 1, opts.requestId ?? newRequestId()]
  )
}

test.describe('Queue notification banners', { tag: ['@ui'] }, () => {
  test.describe('Queuing lifecycle', () => {
    test('promptQueueing event shows a queueing banner', async ({
      comfyPage
    }) => {
      await dispatchPromptQueueing(comfyPage.page)

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('queuing')
    })

    test('promptQueued upgrades a pending banner to queued', async ({
      comfyPage
    }) => {
      await dispatchPromptQueueing(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_PRIMARY
      })

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('queuing')

      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_PRIMARY
      })

      await expect(banner).toContainText('queued')
    })

    test('promptQueued with batch count > 1 shows plural text', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, { batchCount: 3 })

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('3')
      await expect(banner).toContainText('jobs added to queue')
    })

    test('promptQueued with mismatched requestId enqueues a separate queued banner', async ({
      comfyPage
    }) => {
      await dispatchPromptQueueing(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_PRIMARY
      })

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('queuing')

      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_MISMATCH
      })

      // Pending banner is not upgraded — still shows "queuing".
      await expect(banner).toContainText('queuing')

      // After the pending banner auto-dismisses, the queued banner appears.
      await expect(banner).toContainText('queued', {
        timeout: BANNER_ASSERT_TIMEOUT_MS
      })
    })
  })

  test.describe('Auto-dismiss', () => {
    test('Banner auto-dismisses after timeout', async ({ comfyPage }) => {
      await dispatchPromptQueued(comfyPage.page)

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toBeHidden({ timeout: BANNER_ASSERT_TIMEOUT_MS })
    })
  })

  test.describe('Notification queue (FIFO)', () => {
    test('Second notification shows after first auto-dismisses', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_PRIMARY
      })
      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 2,
        requestId: REQUEST_ID_SECONDARY
      })

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('Job queued')
      await expect(banner).toContainText('2 jobs added to queue', {
        timeout: BANNER_ASSERT_TIMEOUT_MS
      })
    })
  })

  test.describe('Direct queued event (no pending predecessor)', () => {
    test('promptQueued without prior queueing shows queued banner directly', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: REQUEST_ID_PRIMARY
      })

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('queued')
    })
  })
})
