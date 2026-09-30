import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.use({ contextOptions: { reducedMotion: 'no-preference' } })

test('keeps the API animation playing across client navigation', async ({
  page
}) => {
  await page.goto('/platform/')
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  const scene = page
    .frameLocator('iframe[src*="/serverless/json-api-gpu-animation.html"]')
    .getByRole('img', { name: 'Comfy image pipeline and GPU orchestration' })

  await expect(scene).toBeVisible()
  await page.getByRole('link', { name: 'Comfy API', exact: true }).click()
  await expect(page).toHaveURL(/\/platform\/comfy-api\/$/)
  await expect(scene).toBeVisible()
  await expect
    .poll(async () => Number(await scene.getAttribute('data-time')))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)

  await page
    .getByRole('link', { name: 'Developer Platform', exact: true })
    .click()
  await expect(page).toHaveURL(/\/platform\/$/)
  await expect(scene).toBeVisible()
  await expect
    .poll(async () => Number(await scene.getAttribute('data-time')))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
})
