import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const BANNER_DISMISS_TIMEOUT = 6_000

function bannerLocator(page: Page) {
  return page.getByTestId(TestIds.queue.notificationBanner)
}

function dispatchPromptQueueing(
  page: Page,
  opts: { batchCount?: number; requestId?: number } = {}
) {
  return page.evaluate(
    ([batchCount, requestId]) => {
      window.app!.api.dispatchCustomEvent('promptQueueing', {
        batchCount,
        requestId
      })
    },
    [opts.batchCount ?? 1, opts.requestId ?? Date.now()] as const
  )
}

function dispatchPromptQueued(
  page: Page,
  opts: { batchCount?: number; requestId?: number } = {}
) {
  return page.evaluate(
    ([batchCount, requestId]) => {
      window.app!.api.dispatchCustomEvent('promptQueued', {
        number: 0,
        batchCount,
        requestId
      })
    },
    [opts.batchCount ?? 1, opts.requestId ?? Date.now()] as const
  )
}

test.describe('Queue notification banners', { tag: ['@ui', '@queue'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.describe('Queuing lifecycle', () => {
    test('promptQueueing event shows a queueing banner', async ({
      comfyPage
    }) => {
      await dispatchPromptQueueing(comfyPage.page)
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('queuing')
    })

    test('promptQueued upgrades a pending banner to queued', async ({
      comfyPage
    }) => {
      const requestId = Date.now()

      await dispatchPromptQueueing(comfyPage.page, {
        batchCount: 1,
        requestId
      })
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('queuing')

      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId
      })
      await comfyPage.nextFrame()

      await expect(banner).toContainText('queued')
    })

    test('promptQueued with batch count > 1 shows plural text', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, { batchCount: 3 })
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('3')
      await expect(banner).toContainText('jobs added to queue')
    })

    test('promptQueued with mismatched requestId does not upgrade pending banner', async ({
      comfyPage
    }) => {
      await dispatchPromptQueueing(comfyPage.page, {
        batchCount: 1,
        requestId: 100
      })
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('queuing')

      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: 999
      })
      await comfyPage.nextFrame()

      await expect(banner).toContainText('queuing')
    })
  })

  test.describe('Auto-dismiss', () => {
    test('Banner auto-dismisses after timeout', async ({ comfyPage }) => {
      await dispatchPromptQueued(comfyPage.page)
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()

      await expect(banner).toBeHidden({ timeout: BANNER_DISMISS_TIMEOUT })
    })
  })

  test.describe('Notification queue (FIFO)', () => {
    test('Second notification shows after first auto-dismisses', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: 1
      })
      await comfyPage.nextFrame()

      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 2,
        requestId: 2
      })
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toContainText('Job queued')

      await expect(banner).toContainText('2 jobs added to queue', {
        timeout: BANNER_DISMISS_TIMEOUT
      })
    })
  })

  test.describe('Direct queued event (no pending predecessor)', () => {
    test('promptQueued without prior queueing shows queued banner directly', async ({
      comfyPage
    }) => {
      await dispatchPromptQueued(comfyPage.page, {
        batchCount: 1,
        requestId: 999
      })
      await comfyPage.nextFrame()

      const banner = bannerLocator(comfyPage.page)
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('queued')
    })
  })
})
