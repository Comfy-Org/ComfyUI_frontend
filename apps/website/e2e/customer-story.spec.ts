import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const prefix of ['', '/zh-CN']) {
  test(`YUI story opens with its film and keeps its directory cover (${prefix || 'en'}) @smoke`, async ({
    page
  }) => {
    const coverRequest = page.waitForRequest(
      'https://media.comfy.org/website/customers/hakoniwa-yui/cover.webp'
    )
    await page.goto(`${prefix}/customers/`)
    await coverRequest
    const story = page.locator(`a[href="${prefix}/customers/hakoniwa-yui/"]`)
    await story.click()
    await expect(page).toHaveURL(`${prefix}/customers/hakoniwa-yui/`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('YUI')
    await expect(
      page.locator('img[src$="/hakoniwa-yui/cover.webp"]')
    ).toHaveCount(0)
    const film = page.locator('video')
    await film.scrollIntoViewIfNeeded()
    await expect(film).toBeVisible()
    await expect(film).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/comfy-agent/andidea-animation-ensub-1080p.mp4'
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://media.comfy.org/website/customers/hakoniwa-yui/cover.webp'
    )
  })

  test(`existing customer stories retain their hero cover (${prefix || 'en'}) @smoke`, async ({
    page
  }) => {
    await page.goto(`${prefix}/customers/series-entertainment/`)
    const title = await page.getByRole('heading', { level: 1 }).innerText()
    const cover = page.getByRole('img', { name: title, exact: true })
    await cover.scrollIntoViewIfNeeded()
    await expect(cover).toBeVisible()
    await expect(cover).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/customers/series-entertainment/cover.webp'
    )
  })
}
