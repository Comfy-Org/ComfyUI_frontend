import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

test('catalogue browsing stays within its JavaScript budget', async ({
  page
}) => {
  await page.goto('/models/')
  await page.getByTestId('workshop-search').fill('kling')
  await page.getByRole('heading', { level: 1 }).click()
  await expect(
    page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
  ).toContainText('Kling')
  const bytes = await page.evaluate(() =>
    performance.getEntriesByType('resource').reduce((total, entry) => {
      if (!(entry instanceof PerformanceResourceTiming)) return total
      const url = new URL(entry.name)
      return url.origin === location.origin && url.pathname.endsWith('.js')
        ? total + entry.decodedBodySize
        : total
    }, 0)
  )
  expect(bytes).toBeGreaterThan(0)
  expect(bytes).toBeLessThan(1_800_000)
})

test('video cards load on screen and stop playing when scrolled away', async ({
  page
}) => {
  await page.goto('/models/')
  await page.getByTestId('workshop-filter').click()
  const videos = page.getByTestId('section-generate-videos').locator('video')
  await expect.poll(() => videos.count()).toBeGreaterThan(0)
  expect(
    await videos.evaluateAll((elements) =>
      elements.every(
        (video) =>
          video instanceof HTMLVideoElement &&
          video.currentSrc === '' &&
          video.paused
      )
    )
  ).toBe(true)

  const first = videos.first()
  await first.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      first.evaluate(
        (video) =>
          video instanceof HTMLVideoElement &&
          video.readyState >= 2 &&
          !video.paused
      )
    )
    .toBe(true)
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      videos.evaluateAll((elements) =>
        elements.every(
          (video) => video instanceof HTMLVideoElement && video.paused
        )
      )
    )
    .toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await first.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      first.evaluate(
        (video) => video instanceof HTMLVideoElement && video.paused
      )
    )
    .toBe(true)
})
