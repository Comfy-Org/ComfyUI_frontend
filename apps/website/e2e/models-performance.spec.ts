import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

/** Same-origin script resources the page has requested so far, by URL. */
function requestedScripts(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming
      )
      .flatMap((entry) => {
        const url = new URL(entry.name)
        return url.origin === location.origin && url.pathname.endsWith('.js')
          ? [[entry.name, entry.decodedBodySize] as const]
          : []
      })
  )
}

test('catalogue browsing stays within its JavaScript budget', async ({
  page
}) => {
  // Every page pays for the layout islands (header, footer, translations,
  // analytics). Charge the catalogue only for what it adds on top of those,
  // so a header change cannot fail this test and a catalogue regression
  // cannot hide behind a shrink elsewhere.
  // The default resource-timing buffer holds 250 entries and drops the rest
  // silently; a late catalogue chunk must not fall off the end.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(2000))
  await page.goto('/')
  const shared = new Set((await requestedScripts(page)).map(([name]) => name))

  await page.goto('/models/')
  await page.getByTestId('workshop-search').fill('kling')
  await page.getByRole('heading', { level: 1 }).click()
  await expect(
    page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
  ).toContainText('Kling')
  const scripts = await requestedScripts(page)
  const catalogueBytes = scripts
    .filter(([name]) => !shared.has(name))
    .reduce((total, [, bytes]) => total + bytes, 0)
  expect(catalogueBytes).toBeGreaterThan(0)
  expect(catalogueBytes).toBeLessThan(900_000)
  // The whole-route ceiling stays as well: catalogue code that migrated into
  // a chunk the homepage also loads would pass the delta and still be paid
  // for by every visitor to /models/.
  const totalBytes = scripts.reduce((total, [, bytes]) => total + bytes, 0)
  expect(totalBytes).toBeLessThan(1_811_000)
})

test('video cards load on screen and stop playing when scrolled away', async ({
  page
}) => {
  await page.goto('/models/')
  await page.getByTestId('workshop-filter').click()
  const videos = page.getByTestId('section-generate-videos').locator('video')
  await expect.poll(() => videos.count()).toBeGreaterThan(0)
  await expect
    .poll(() =>
      videos.evaluateAll((elements: HTMLVideoElement[]) =>
        elements.every((video) => video.currentSrc === '' && video.paused)
      )
    )
    .toBe(true)

  const first = videos.first()
  await first.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      first.evaluate(
        (video: HTMLVideoElement) => video.readyState >= 2 && !video.paused
      )
    )
    .toBe(true)
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      videos.evaluateAll((elements: HTMLVideoElement[]) =>
        elements.every((video) => video.paused)
      )
    )
    .toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await first.scrollIntoViewIfNeeded()
  // The source is attached (so the frame can show) before playback would have
  // started; asserting `paused` earlier than that proves nothing.
  await expect
    .poll(() => first.evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(1)
  await expect
    .poll(() => first.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
})
