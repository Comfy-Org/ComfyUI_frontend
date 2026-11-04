import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  expectVueDirectiveContext,
  findErrorEvent,
  injectThrowingDirectiveFrame,
  stubSentryDsnAndEnvelopes,
  waitForCrashEnvelope
} from '@e2e/fixtures/helpers/SentryEnvelopeHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const CRASH_MESSAGE_MARKER = 'e2e: simulated Safari directive-tuple'

test.describe(
  'FE-3163: Vue directive failure Sentry attribution',
  { tag: '@mobile-ios' },
  () => {
    test('tags a directive-shaped crash for production attribution', async ({
      page
    }) => {
      await stubSentryDsnAndEnvelopes(page)

      await page.goto(APP_URL)
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible({
        timeout: 30_000
      })

      const crashEnvelope = waitForCrashEnvelope(page, CRASH_MESSAGE_MARKER)
      await injectThrowingDirectiveFrame(
        page,
        `${CRASH_MESSAGE_MARKER} destructuring failure (FE-3163)`
      )

      expectVueDirectiveContext(findErrorEvent(await crashEnvelope))
    })
  }
)
