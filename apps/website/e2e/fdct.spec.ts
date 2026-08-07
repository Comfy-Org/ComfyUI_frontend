import { expect } from '@playwright/test'

import { fdctFaqs, projects, technologists } from '../src/data/fdct'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const builderReasonKeys = [
  'fdct.builders.reason1',
  'fdct.builders.reason2',
  'fdct.builders.reason3',
  'fdct.builders.reason4'
] as const

const howItWorksStepTitleKeys = [
  'fdct.howItWorks.step1.title',
  'fdct.howItWorks.step2.title',
  'fdct.howItWorks.step3.title',
  'fdct.howItWorks.step4.title'
] as const

const whatYouGetItemKeys = [
  'fdct.whatYouGet.item1',
  'fdct.whatYouGet.item2',
  'fdct.whatYouGet.item3',
  'fdct.whatYouGet.item4',
  'fdct.whatYouGet.item5'
] as const

test.describe('FDCT page @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'en'))
  })

  test('hero renders the h1 and CTA pair with decided hrefs', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'en')
    )
    const hero = page.locator('section', {
      has: page.getByRole('heading', { level: 1 })
    })
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.contactCta', 'en') })
    ).toHaveAttribute('href', '/contact')
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.applyCta', 'en') })
    ).toHaveAttribute('href', '#')
  })

  test('builders section renders the node label, reasons, and marquee', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.builders.title', 'en') })
    ).toBeVisible()
    await expect(
      page
        .getByText(t('fdct.builders.nodeLabel', 'en'), { exact: true })
        .first()
    ).toBeVisible()
    for (const key of builderReasonKeys) {
      await expect(page.getByText(t(key, 'en')).first()).toBeVisible()
    }
    await expect(page.getByTestId('social-proof-desktop')).toBeVisible()
  })

  test('how it works steps and what-you-get checklist render', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.howItWorks.title', 'en') })
    ).toBeVisible()
    for (const key of howItWorksStepTitleKeys) {
      await expect(
        page.getByRole('heading', { name: t(key, 'en'), exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByText(t('fdct.howItWorks.footnote', 'en'))
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: t('fdct.whatYouGet.title', 'en') })
    ).toBeVisible()
    for (const key of whatYouGetItemKeys) {
      await expect(page.getByText(t(key, 'en'))).toBeVisible()
    }
  })

  test('featured technologists renders the heading and three cards', async ({
    page
  }) => {
    await page.goto('/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.technologists.title', 'en')
      })
    })
    await expect(
      section.getByRole('heading', {
        name: t('fdct.technologists.title', 'en')
      })
    ).toBeVisible()
    for (const person of technologists) {
      await expect(
        section.getByText(person.name, { exact: true })
      ).toBeVisible()
    }
  })

  test('past projects renders six cards with author and category', async ({
    page
  }) => {
    await page.goto('/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: t('fdct.projects.title', 'en') })
    })
    await expect(
      section.locator(`a[aria-label$="${t('fdct.projects.cta', 'en')}"]`)
    ).toHaveCount(projects.length)
    for (const project of projects) {
      await expect(
        section.getByRole('link', {
          name: `${project.title} — ${t('fdct.projects.cta', 'en')}`
        })
      ).toHaveCount(1)
    }
    await expect(
      section.getByText(projects[0].author.name).first()
    ).toBeVisible()
    await expect(
      section
        .getByText(t(`fdct.projects.category.${projects[0].category}`, 'en'), {
          exact: true
        })
        .first()
    ).toBeVisible()
  })

  test('Q&A renders five questions and expands one to reveal its answer', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.faq.title', 'en') })
    ).toBeVisible()
    const faqs = fdctFaqs('en')
    for (const faq of faqs) {
      await expect(
        page.getByRole('button', { name: faq.question })
      ).toBeVisible()
    }
    const fourth = faqs[3]
    await page.getByRole('button', { name: fourth.question }).click()
    await expect(page.getByText(fourth.answer)).toBeVisible()
  })

  test('emits FAQPage structured data with the five Q&A pairs', async ({
    page
  }) => {
    await page.goto('/fdct')
    const faqJsonLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]'
        )
      )
      const match = scripts.find((s) =>
        (s.textContent ?? '').includes('FAQPage')
      )
      return match?.textContent ?? null
    })
    expect(faqJsonLd, 'FAQ JSON-LD script').not.toBeNull()
    const graph = JSON.parse(faqJsonLd!)['@graph'] as {
      '@type': string
      mainEntity?: { name: string }[]
    }[]
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node in @graph').toBeDefined()
    expect(faqPage!.mainEntity!.map((entity) => entity.name)).toEqual(
      fdctFaqs('en').map((faq) => faq.question)
    )
  })

  test('CTA bands render both labels with the decided hrefs', async ({
    page
  }) => {
    await page.goto('/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.bands.enterprise.label', 'en')
      })
    })
    await expect(
      section.getByRole('heading', {
        name: t('fdct.bands.enterprise.label', 'en')
      })
    ).toBeVisible()
    await expect(
      section.getByRole('heading', {
        name: t('fdct.bands.creators.label', 'en')
      })
    ).toBeVisible()
    await expect(
      section.getByRole('link', { name: t('fdct.bands.enterprise.cta', 'en') })
    ).toHaveAttribute('href', '/contact')
    await expect(
      section.getByRole('link', { name: t('fdct.bands.creators.cta', 'en') })
    ).toHaveAttribute('href', '/careers')
  })
})

test.describe('FDCT page (zh-CN) @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/zh-CN/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'zh-CN'))
  })

  test('hero renders the localized h1 and locale-prefixed contact CTA', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'zh-CN')
    )
    const hero = page.locator('section', {
      has: page.getByRole('heading', { level: 1 })
    })
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.contactCta', 'zh-CN') })
    ).toHaveAttribute('href', '/zh-CN/contact')
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.applyCta', 'zh-CN') })
    ).toHaveAttribute('href', '#')
  })

  test('builders section renders the localized node label and reasons', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.builders.title', 'zh-CN') })
    ).toBeVisible()
    await expect(
      page
        .getByText(t('fdct.builders.nodeLabel', 'zh-CN'), { exact: true })
        .first()
    ).toBeVisible()
    for (const key of builderReasonKeys) {
      await expect(page.getByText(t(key, 'zh-CN')).first()).toBeVisible()
    }
  })

  test('how it works steps and what-you-get checklist render localized', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.howItWorks.title', 'zh-CN') })
    ).toBeVisible()
    for (const key of howItWorksStepTitleKeys) {
      await expect(
        page.getByRole('heading', { name: t(key, 'zh-CN'), exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByText(t('fdct.howItWorks.footnote', 'zh-CN'))
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: t('fdct.whatYouGet.title', 'zh-CN') })
    ).toBeVisible()
    for (const key of whatYouGetItemKeys) {
      await expect(page.getByText(t(key, 'zh-CN'))).toBeVisible()
    }
  })

  test('featured technologists renders the localized heading and three cards', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.technologists.title', 'zh-CN')
      })
    })
    await expect(
      section.getByRole('heading', {
        name: t('fdct.technologists.title', 'zh-CN')
      })
    ).toBeVisible()
    for (const person of technologists) {
      await expect(
        section.getByText(person.name, { exact: true })
      ).toBeVisible()
    }
  })

  test('past projects renders six cards under the localized heading', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.projects.title', 'zh-CN')
      })
    })
    await expect(
      section.locator(`a[aria-label$="${t('fdct.projects.cta', 'zh-CN')}"]`)
    ).toHaveCount(projects.length)
    await expect(
      section
        .getByText(
          t(`fdct.projects.category.${projects[0].category}`, 'zh-CN'),
          { exact: true }
        )
        .first()
    ).toBeVisible()
  })

  test('Q&A renders the five localized questions and expands one', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.faq.title', 'zh-CN') })
    ).toBeVisible()
    const faqs = fdctFaqs('zh-CN')
    for (const faq of faqs) {
      await expect(
        page.getByRole('button', { name: faq.question })
      ).toBeVisible()
    }
    const fourth = faqs[3]
    await page.getByRole('button', { name: fourth.question }).click()
    await expect(page.getByText(fourth.answer)).toBeVisible()
  })

  test('CTA bands render localized labels with locale-prefixed hrefs', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.bands.enterprise.label', 'zh-CN')
      })
    })
    await expect(
      section.getByRole('heading', {
        name: t('fdct.bands.creators.label', 'zh-CN')
      })
    ).toBeVisible()
    await expect(
      section.getByRole('link', {
        name: t('fdct.bands.enterprise.cta', 'zh-CN')
      })
    ).toHaveAttribute('href', '/zh-CN/contact')
    await expect(
      section.getByRole('link', { name: t('fdct.bands.creators.cta', 'zh-CN') })
    ).toHaveAttribute('href', '/zh-CN/careers')
  })
})
