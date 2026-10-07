import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const sourceURL =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/changelog/index.mdx'
const release = (label: string) =>
  `<Update label="${label}" description="October 5, 2026">\n**New features**\n\n${Array.from({ length: 24 }, (_, i) => `* Feature ${i + 1}`).join('\n')}\n</Update>`

test('keeps release metadata pinned within its release on desktop', async ({
  page,
  context
}) => {
  await context.route(sourceURL, (route) =>
    route.fulfill({ body: `${release('v1.0')}\n${release('v0.9')}` })
  )
  await page.goto('/changelog')
  await expect(
    page.getByRole('heading', { name: 'v1.0', exact: true })
  ).toBeVisible()
  const first = page.locator('article').first()
  const metadata = first.getByTestId('release-metadata')
  const notes = first.getByTestId('release-notes')
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
  const metadata = page.getByTestId('release-metadata')
  const bounds = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width)
  const metadataBox = await metadata.boundingBox()
  const notesBox = await page.getByTestId('release-notes').boundingBox()
  expect(notesBox!.y).toBeGreaterThan(metadataBox!.y + metadataBox!.height)
})
