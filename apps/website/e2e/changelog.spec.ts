import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { CHANGELOG_SOURCE } from '@/lib/changelog'

import { test } from './fixtures/blockExternalMedia'

const release = (label: string, extra = '') =>
  `<Update label="${label}" description="October 5, 2026">\n**New features**\n\n${Array.from({ length: 24 }, (_, i) => `* Feature ${i + 1}`).join('\n')}\n${extra}</Update>`

const longLine = `https://docs.comfy.org/${'unbroken-path-segment-'.repeat(12)}`
const longCode = `\n\`\`\`\n${'const veryLongIdentifier = 1; '.repeat(12)}\n\`\`\`\n`

async function box(locator: Locator) {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Element has no bounding box')
  return bounds
}

test('keeps release metadata pinned within its release on desktop', async ({
  page,
  context
}) => {
  await context.route(CHANGELOG_SOURCE, (route) =>
    route.fulfill({ body: `${release('v1.0')}\n${release('v0.9')}` })
  )
  await page.goto('/changelog')
  const first = page.getByRole('article', { name: 'v1.0' })
  await expect(first).toBeVisible()
  const metadata = first.getByTestId('release-metadata')
  const notes = first.getByTestId('release-notes')

  await test.step('aligns the metadata with the first note block', async () => {
    await expect
      .poll(async () =>
        Math.abs((await box(metadata)).y - (await box(notes)).y)
      )
      .toBeLessThan(2)
  })

  await test.step('pins the metadata at its sticky offset while reading', async () => {
    const stickyTop = await metadata.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).top)
    )
    await first.evaluate((el) =>
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 200)
    )
    await expect
      .poll(async () => Math.abs((await box(metadata)).y - stickyTop))
      .toBeLessThan(1)
  })

  await test.step('keeps the metadata inside its release when the next one scrolls in', async () => {
    await page.getByRole('article', { name: 'v0.9' }).scrollIntoViewIfNeeded()
    await expect
      .poll(async () => {
        const [release, pinned] = await Promise.all([box(first), box(metadata)])
        return pinned.y + pinned.height - (release.y + release.height)
      })
      .toBeLessThanOrEqual(1)
  })
})

test('stacks release metadata without horizontal overflow @mobile', async ({
  page,
  context
}) => {
  await context.route(CHANGELOG_SOURCE, (route) =>
    route.fulfill({ body: release('v1.0', `\n${longLine}\n${longCode}`) })
  )
  await page.goto('/changelog')
  const article = page.getByRole('article', { name: 'v1.0' })
  await expect(article).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    )
    .toBeLessThanOrEqual(0)
  const notes = article.getByTestId('release-notes')
  await expect
    .poll(() => notes.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(0)
  await expect
    .poll(async () => {
      const [metadataBox, notesBox] = await Promise.all([
        box(article.getByTestId('release-metadata')),
        box(notes)
      ])
      return notesBox.y - (metadataBox.y + metadataBox.height)
    })
    .toBeGreaterThan(0)
})
