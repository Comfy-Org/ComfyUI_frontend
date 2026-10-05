import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const sourceURL =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/changelog/index.mdx'
const release = (label: string) =>
  `<Update label="${label}" description="October 5, 2026">\n**New features**\n\n${Array.from({ length: 24 }, (_, i) => `* Feature ${i + 1}`).join('\n')}\n</Update>`

test('refreshes docs releases without a rebuild and keeps metadata within each release', async ({
  page,
  context
}) => {
  let label = 'v1.0'
  await context.route(sourceURL, (route) =>
    route.fulfill({ body: `${release(label)}\n${release('v0.9')}` })
  )
  await page.clock.install()
  await page.goto('/changelog')
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'VIEW DOCS', exact: true })
  ).toHaveAttribute('href', 'https://docs.comfy.org/changelog/index')
  await expect(
    page.locator('header').getByRole('link', { name: 'Changelog' })
  ).toHaveCount(0)
  const resources = page.getByRole('navigation', { name: 'Resources' })
  await expect(resources.getByRole('link').last()).toHaveText('Changelog')
  const first = page.locator('article').first()
  const metadata = first.locator('.release-metadata')
  const notes = first.locator('.release-metadata + div')
  const top = await metadata.boundingBox()
  const notesTop = await notes.boundingBox()
  expect(top).not.toBeNull()
  expect(notesTop).not.toBeNull()
  expect(Math.abs(top!.y - notesTop!.y)).toBeLessThan(2)
  await page.evaluate(() =>
    window.scrollTo(0, document.querySelector('article')!.offsetTop + 200)
  )
  await expect
    .poll(async () => (await metadata.boundingBox())?.y)
    .toBeCloseTo(144, 0)
  await page.locator('article').nth(1).scrollIntoViewIfNeeded()
  const firstBox = await first.boundingBox()
  const metadataBox = await metadata.boundingBox()
  expect(metadataBox!.y + metadataBox!.height).toBeLessThanOrEqual(
    firstBox!.y + firstBox!.height + 1
  )
  label = 'v1.1'
  await page.clock.fastForward(5 * 60 * 1000)
  await expect(
    page.getByRole('heading', { name: 'v1.1', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toHaveCount(0)
})

test('shows loading, failure, retry and saved releases', async ({
  page,
  context
}) => {
  let finish: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let failing = true
  await context.route(sourceURL, async (route) => {
    await pending
    await route.fulfill({ status: failing ? 503 : 200, body: release('v1.0') })
  })
  await page.goto('/changelog')
  await expect(page.getByRole('status')).toContainText('Loading')
  finish!()
  await expect(page.getByRole('status')).toContainText('could not be loaded')
  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toBeVisible()
  failing = true
  await page.reload()
  await expect(page.getByRole('status')).toContainText('saved')
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toBeVisible()
})

test('stacks release metadata without horizontal overflow @mobile', async ({
  page,
  context
}) => {
  await context.route(sourceURL, (route) =>
    route.fulfill({ body: release('v1.0') })
  )
  await page.goto('/changelog')
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toBeVisible()
  const metadata = page.locator('.release-metadata')
  expect(await metadata.evaluate((el) => getComputedStyle(el).position)).toBe(
    'static'
  )
  const bounds = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width)
  const metadataBox = await metadata.boundingBox()
  const notesBox = await page.locator('.release-metadata + div').boundingBox()
  expect(notesBox!.y).toBeGreaterThan(metadataBox!.y + metadataBox!.height)
})
