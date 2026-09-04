import { expect } from '@playwright/test'

import { customerVideoStories } from '../src/data/customerVideos'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('Customers @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customers')
  })

  test('shows a visible Home > Customers breadcrumb, never linking the current page', async ({
    page
  }) => {
    const breadcrumb = page.getByRole('navigation', {
      name: t('ui.breadcrumb', 'en')
    })
    await expect(
      breadcrumb.getByRole('link', { name: t('breadcrumb.home', 'en') })
    ).toHaveAttribute('href', '/')
    await expect(
      breadcrumb.getByText(t('nav.customerStories', 'en'))
    ).toBeVisible()
    await expect(
      breadcrumb.locator('a', { hasText: t('nav.customerStories', 'en') })
    ).toHaveCount(0)
  })

  test('the directory has no <video> elements and makes no WebM requests', async ({
    page
  }) => {
    const webmRequests: string[] = []
    page.on('request', (request) => {
      if (/\.webm(\?|$)/i.test(request.url())) webmRequests.push(request.url())
    })

    await page.goto('/customers')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('video')).toHaveCount(0)
    expect(webmRequests).toEqual([])
  })

  test('the WATCH group links each video story to its dedicated watch page', async ({
    page
  }) => {
    const watchHeading = page.getByText(t('customers.group.watch', 'en'))
    await expect(watchHeading).toBeVisible()

    for (const story of customerVideoStories) {
      const card = page.locator(`a[href="/customers/videos/${story.slug}"]`)
      await expect(card).toBeVisible()
      await expect(card).toContainText(story.company)
      await expect(card).toContainText(t('customers.video.watchStory', 'en'))
    }
  })

  test('shows a READ group heading above the written stories', async ({
    page
  }) => {
    await expect(page.getByText(t('customers.group.read', 'en'))).toBeVisible()
  })

  test('hero image declares intrinsic dimensions so layout reserves space before load', async ({
    page
  }) => {
    const heroImage = page.locator('img[alt="Comfy 3D logo"]')
    await expect(heroImage).toBeVisible()
    await expect(heroImage).toHaveAttribute('width', /^\d+$/)
    await expect(heroImage).toHaveAttribute('height', /^\d+$/)

    const heightWhileUnloaded = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(
        'img[alt="Comfy 3D logo"]'
      )
      if (!img) return null
      img.removeAttribute('src')
      return img.getBoundingClientRect().height
    })

    expect(heightWhileUnloaded).not.toBeNull()
    expect(heightWhileUnloaded!).toBeGreaterThan(100)
  })

  test('emits one connected JSON-LD graph describing the story collection', async ({
    page
  }) => {
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    const types = graph.map((node) => node['@type'])
    expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
    expect(types).toContain('CollectionPage')
    expect(types).toContain('BreadcrumbList')

    const cardSlugs = await page
      .locator('a[href^="/customers/"]')
      .evaluateAll((links) => [
        ...new Set(
          links
            .map((link) => link.getAttribute('href'))
            .filter((href): href is string =>
              /^\/customers\/[a-z0-9-]+$/.test(href ?? '')
            )
        )
      ])
    expect(cardSlugs.length).toBeGreaterThan(0)

    const list = graph.find((node) => node['@type'] === 'ItemList')
    expect(list?.itemListElement as unknown[]).toHaveLength(cardSlugs.length)
  })

  test('emits locale-derived JSON-LD URLs on the Chinese route', async ({
    page
  }) => {
    await page.goto('/zh-CN/customers')

    await expect(page.locator('a[href*="/customers/"]').first()).toBeVisible()

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    expect(graph.map((node) => node['@type'])).toContain('CollectionPage')
    expect(blocks[0]).toContain('/zh-CN/customers')
  })
})
