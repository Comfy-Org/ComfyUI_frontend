import { expect } from '@playwright/test'

import { t } from '@/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('Customer-story internal links @smoke', () => {
  test('main nav featured card links to the Black Math watch page', async ({
    page
  }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks
      .getByRole('button', { name: t('nav.company', {}, { locale: 'en' }) })
      .hover()

    await expect(
      nav.getByRole('link', {
        name: t('nav.featuredCompanyCtaAria', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/customers/videos/black-math/')
  })

  test('main nav Company menu links to Customer Stories', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks
      .getByRole('button', { name: t('nav.company', {}, { locale: 'en' }) })
      .hover()

    await expect(
      nav.getByRole('link', {
        name: t('nav.customerStories', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/customers/')
  })

  test('homepage case-study section keeps SEE ALL and adds a link to the Black Math watch page', async ({
    page
  }) => {
    await page.goto('/')
    const section = page.locator('section', {
      has: page.getByText(t('caseStudy.label', {}, { locale: 'en' }))
    })

    await expect(
      section.getByRole('link', {
        name: t('caseStudy.watchStory', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/customers/videos/black-math/')
    await expect(
      section.getByRole('link', {
        name: t('caseStudy.seeAll', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/customers/')
  })

  test('footer resources column lists Customer Stories', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('contentinfo').getByRole('link', {
        name: t('nav.customerStories', {}, { locale: 'en' })
      })
    ).toHaveAttribute('href', '/customers/')
  })

  test('pricing page enterprise CTA links to the Enterprise page', async ({
    page
  }) => {
    await page.goto('/pricing')

    await expect(page.getByTestId('enterprise-cta')).toHaveAttribute(
      'href',
      '/enterprise/'
    )
  })
})
