import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Customer story detail @smoke', () => {
  test('renders the migrated article: hero, section nav, and body', async ({
    page
  }) => {
    await page.goto('/customers/series-entertainment')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Series Entertainment Rebuilt Game and Video Production/i
      })
    ).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Category filter' })
    await expect(nav.getByRole('button', { name: 'INTRO' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'CONCLUSION' })).toBeVisible()

    // Section title rendered from the MDX <Section title> wrapper.
    await expect(
      page.getByRole('heading', {
        name: 'The Output Series Achieved Using ComfyUI'
      })
    ).toBeVisible()
  })

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

    // series-entertainment only redirected back to itself, so the link is gone.
    await page.goto('/customers/series-entertainment')
    await expect(
      page.getByRole('link', { name: /read more on this topic/i })
    ).toHaveCount(0)
  })

  test('links to the next story in the what-is-next section', async ({
    page
  }) => {
    await page.goto('/customers/series-entertainment')
    const nextLink = page.getByRole('link', { name: /view article/i })
    await expect(nextLink).toBeVisible()
    // Links to another customer story, without coupling the test to the
    // specific slug or sort order.
    await expect(nextLink).toHaveAttribute('href', /^\/customers\/[a-z0-9-]+$/)
    await expect(nextLink).not.toHaveAttribute(
      'href',
      '/customers/series-entertainment'
    )
  })
})
