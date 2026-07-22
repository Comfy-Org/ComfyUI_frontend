import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Customer story detail @smoke', () => {
  test('section nav highlights the section the reader selects', async ({
    page
  }) => {
    await page.goto('/customers/series-entertainment')
    const nav = page.getByRole('navigation', { name: 'Category filter' })
    const intro = nav.getByRole('button', { name: 'INTRO' })
    const problem = nav.getByRole('button', { name: 'THE PROBLEM' })

    await expect(intro).toHaveAttribute('aria-pressed', 'true')

    await problem.click()
    await expect(problem).toHaveAttribute('aria-pressed', 'true')
  })

  test('shows the read-more link only when an external source exists', async ({
    page
  }) => {
    await page.goto('/customers/open-story-movement')
    await expect(
      page.getByRole('link', { name: /read more on this topic/i })
    ).toBeVisible()

    await page.goto('/customers/series-entertainment')
    await expect(
      page.getByRole('link', { name: /read more on this topic/i })
    ).toHaveCount(0)
  })

  test('renders the Download content component as an accessible workflow link', async ({
    page
  }) => {
    await page.goto('/customers/xindi-zhang')
    await expect(
      page.getByRole('link', {
        name: /Download Xindi's style transfer workflow/i
      })
    ).toBeVisible()
  })

  test('renders the education CTA on a Creative Campus story', async ({
    page
  }) => {
    await page.goto('/customers/xindi-zhang')
    await expect(
      page.getByRole('link', { name: /Explore the Education Program/i })
    ).toBeVisible()
  })

  test('emits an Article JSON-LD graph for the story', async ({ page }) => {
    await page.goto('/customers/series-entertainment')

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    const types = graph.map((node) => node['@type'])
    expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
    expect(types).toContain('WebPage')
    expect(types).toContain('BreadcrumbList')

    const article = graph.find((node) => node['@type'] === 'Article')
    expect(article?.headline).toMatch(/Series Entertainment/i)
  })

  test('emits a locale-derived Article graph on the Chinese route', async ({
    page
  }) => {
    await page.goto('/zh-CN/customers/golan-levin')

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    expect(graph.map((node) => node['@type'])).toContain('Article')
    expect(blocks[0]).toContain('/zh-CN/customers/golan-levin')
  })
})

test.describe('Customer story detail navigation', () => {
  test('links to another story in the what-is-next section', async ({
    page
  }) => {
    await page.goto('/customers/series-entertainment')
    const nextLink = page.getByRole('link', { name: /view article/i })
    await expect(nextLink).toBeVisible()
    await expect(nextLink).toHaveAttribute('href', /^\/customers\/[a-z0-9-]+$/)
    await expect(nextLink).not.toHaveAttribute(
      'href',
      '/customers/series-entertainment'
    )
  })
})
