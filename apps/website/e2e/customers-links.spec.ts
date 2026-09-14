import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('Customer-story internal links @smoke', () => {
  test('main nav featured card links to the Black Math watch page', async ({
    page
  }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks
      .getByRole('button', { name: t('nav.company', 'en') })
      .hover()

    await expect(
      nav.getByRole('link', {
        name: t('nav.featuredCompanyCtaAria', 'en')
      })
    ).toHaveAttribute('href', '/customers/videos/black-math')
  })

  test('homepage case-study section keeps SEE ALL and adds a link to the Black Math watch page', async ({
    page
  }) => {
    await page.goto('/')
    const section = page.locator('section', {
      has: page.getByText(t('caseStudy.label', 'en'))
    })

    await expect(
      section.getByRole('link', { name: t('caseStudy.watchStory', 'en') })
    ).toHaveAttribute('href', '/customers/videos/black-math')
    await expect(
      section.getByRole('link', { name: t('caseStudy.seeAll', 'en') })
    ).toHaveAttribute('href', '/customers')
  })

  test('footer resources column lists Customer Stories', async ({ page }) => {
    await page.goto('/')
    await expect(
      page
        .getByRole('contentinfo')
        .getByRole('link', { name: t('nav.customerStories', 'en') })
    ).toHaveAttribute('href', '/customers')
  })

  test('pricing page enterprise CTA links to the Enterprise page', async ({
    page
  }) => {
    await page.goto('/pricing')

    await expect(
      page.getByRole('link', {
        name: t('pricing.enterprise.learnMore', 'en'),
        exact: true
      })
    ).toHaveAttribute('href', '/enterprise')
  })
})
