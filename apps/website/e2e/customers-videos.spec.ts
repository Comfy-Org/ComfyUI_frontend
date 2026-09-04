import { expect } from '@playwright/test'

import {
  customerVideoPath,
  customerVideoStories,
  getCustomerVideoStory
} from '../src/data/customerVideos'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const blackMath = getCustomerVideoStory('black-math')
const silverside = getCustomerVideoStory('silverside-ai')

test.describe('Customer watch pages @smoke', () => {
  // One navigation per story covers title/meta/canonical/H1, the visible
  // breadcrumb and its matching BreadcrumbList, the VideoObject JSON-LD, the
  // player, and the browse-all link — separate tests would each pay for
  // their own page load for no added confidence.
  for (const story of customerVideoStories) {
    test(`${story.slug}: metadata, breadcrumb, JSON-LD, and player`, async ({
      page
    }) => {
      await page.goto(customerVideoPath(story.slug))

      await expect(page).toHaveTitle(`${story.title} - Comfy`)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        story.description
      )
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://comfy.org${customerVideoPath(story.slug)}/`
      )
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        story.title
      )

      const breadcrumb = page.getByRole('navigation', {
        name: t('ui.breadcrumb', 'en')
      })
      await expect(
        breadcrumb.getByRole('link', { name: t('breadcrumb.home', 'en') })
      ).toHaveAttribute('href', '/')
      await expect(
        breadcrumb.getByRole('link', {
          name: t('nav.customerStories', 'en')
        })
      ).toHaveAttribute('href', '/customers')
      // The current page is plain text, never a link, in both the visible
      // breadcrumb and the JSON-LD BreadcrumbList.
      await expect(breadcrumb.getByText(story.title)).toBeVisible()
      await expect(
        breadcrumb.locator('a', { hasText: story.title })
      ).toHaveCount(0)

      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents()
      const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
      const types = graph.map((node) => node['@type'])
      expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
      expect(types).toContain('WebPage')
      expect(types).toContain('BreadcrumbList')

      const crumbList = graph.find((node) => node['@type'] === 'BreadcrumbList')
      const items = crumbList?.itemListElement as
        | { name: string; item?: string }[]
        | undefined
      expect(items?.map((item) => item.name)).toEqual([
        t('breadcrumb.home', 'en'),
        t('nav.customerStories', 'en'),
        story.title
      ])
      expect(items?.at(-1)?.item).toBeUndefined()

      const video = graph.find((node) => node['@type'] === 'VideoObject')
      expect(video?.name).toBe(story.title)
      expect(video?.description).toBe(story.description)
      expect(video?.thumbnailUrl).toBe(story.poster)
      expect(video?.contentUrl).toBe(story.videoSrc)
      expect(video?.inLanguage).toBe('en')
      expect((video?.publisher as { '@id'?: string })?.['@id']).toBe(
        'https://comfy.org/#organization'
      )

      const webPage = graph.find((node) => node['@type'] === 'WebPage')
      expect((webPage?.mainEntity as { '@id'?: string })?.['@id']).toBe(
        video?.['@id']
      )

      const player = page.locator('video')
      await expect(player).toHaveCount(1)
      await expect(player).toHaveAttribute('src', story.videoSrc)
      await expect(player).toHaveAttribute('poster', story.poster)
      await expect(player).not.toHaveAttribute('autoplay', '')
      await expect(player).not.toHaveAttribute('muted', '')

      const track = player.locator('track')
      await expect(track).toHaveAttribute('src', story.captions[0].src)
      await expect(track).toHaveAttribute('kind', 'subtitles')

      await expect(
        page.getByRole('link', { name: t('customers.watch.browseAll', 'en') })
      ).toHaveAttribute('href', '/customers')
    })
  }

  test('the two watch pages reciprocally link to each other, and Silverside also links its written article', async ({
    page
  }) => {
    await page.goto(customerVideoPath('black-math'))
    await expect(
      page.locator(`a[href="${customerVideoPath('silverside-ai')}"]`)
    ).toBeVisible()
    expect(blackMath.relatedStorySlug).toBeUndefined()

    await page.goto(customerVideoPath('silverside-ai'))
    await expect(
      page.locator(`a[href="${customerVideoPath('black-math')}"]`)
    ).toBeVisible()
    expect(silverside.relatedStorySlug).toBe('svedka-silverside')
    await expect(
      page.locator(`a[href="/customers/${silverside.relatedStorySlug}"]`, {
        hasText: t('customers.watch.readWrittenStory', 'en')
      })
    ).toBeVisible()
  })

  test('has no zh-CN twin: the watch page is English-only', async ({
    page
  }) => {
    const response = await page.goto('/zh-CN/customers/videos/black-math')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Silverside written story vs watch page @smoke', () => {
  test('the article and the watch page carry distinct titles and canonicals, and the article links to the watch page', async ({
    page
  }) => {
    await page.goto('/customers/svedka-silverside')
    const articleTitle = await page.title()
    const articleCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')
    await expect(
      page.locator(`a[href="${customerVideoPath('silverside-ai')}"]`)
    ).toBeVisible()

    await page.goto(customerVideoPath('silverside-ai'))
    const watchTitle = await page.title()
    const watchCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')

    expect(watchTitle).not.toBe(articleTitle)
    expect(watchCanonical).not.toBe(articleCanonical)
  })
})
