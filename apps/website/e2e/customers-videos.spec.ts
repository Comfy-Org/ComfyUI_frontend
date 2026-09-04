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
  for (const story of customerVideoStories) {
    test(`${story.slug}: unique title, meta description, canonical, and H1`, async ({
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
    })

    test(`${story.slug}: visible breadcrumb agrees with BreadcrumbList JSON-LD`, async ({
      page
    }) => {
      await page.goto(customerVideoPath(story.slug))

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
    })

    test(`${story.slug}: emits VideoObject as the page's main entity`, async ({
      page
    }) => {
      await page.goto(customerVideoPath(story.slug))

      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents()
      const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
      const types = graph.map((node) => node['@type'])
      expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
      expect(types).toContain('WebPage')
      expect(types).toContain('BreadcrumbList')

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
    })

    test(`${story.slug}: one video, controls, captions, and no autoplay`, async ({
      page
    }) => {
      await page.goto(customerVideoPath(story.slug))

      const video = page.locator('video')
      await expect(video).toHaveCount(1)
      await expect(video).toHaveAttribute('src', story.videoSrc)
      await expect(video).toHaveAttribute('poster', story.poster)
      await expect(video).not.toHaveAttribute('autoplay', '')
      await expect(video).not.toHaveAttribute('muted', '')

      const track = video.locator('track')
      await expect(track).toHaveAttribute('src', story.captions[0].src)
      await expect(track).toHaveAttribute('kind', 'subtitles')
    })

    test(`${story.slug}: links to the directory and browse-all CTA`, async ({
      page
    }) => {
      await page.goto(customerVideoPath(story.slug))

      await expect(
        page.getByRole('link', {
          name: t('customers.watch.browseAll', 'en')
        })
      ).toHaveAttribute('href', '/customers')
    })
  }

  test('the Black Math page links to the Silverside AI watch page as a related story', async ({
    page
  }) => {
    await page.goto(customerVideoPath('black-math'))
    await expect(
      page.locator(`a[href="${customerVideoPath('silverside-ai')}"]`)
    ).toBeVisible()
    expect(blackMath.relatedStorySlug).toBeUndefined()
  })

  test('the Silverside AI page links back to Black Math and to its written article', async ({
    page
  }) => {
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
  test('the article and the watch page carry distinct titles, descriptions, and canonicals', async ({
    page
  }) => {
    await page.goto('/customers/svedka-silverside')
    const articleTitle = await page.title()
    const articleCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')

    await page.goto(customerVideoPath('silverside-ai'))
    const watchTitle = await page.title()
    const watchCanonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')

    expect(watchTitle).not.toBe(articleTitle)
    expect(watchCanonical).not.toBe(articleCanonical)
  })

  test('the written article links to the Silverside watch page', async ({
    page
  }) => {
    await page.goto('/customers/svedka-silverside')
    await expect(
      page.locator(`a[href="${customerVideoPath('silverside-ai')}"]`)
    ).toBeVisible()
  })
})
