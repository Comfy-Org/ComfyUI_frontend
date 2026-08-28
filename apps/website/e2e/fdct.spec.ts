import { expect } from '@playwright/test'

import {
  fdctFaqs,
  featuredProjects as featuredProjectsOf,
  projects as hubProjectsOf,
  technologists as technologistsOf
} from '../src/data/fdct'
import { t } from '../src/i18n/translations'
import { faqAnswerPlainText } from '../src/utils/faqAnswer'
import { test } from './fixtures/blockExternalMedia'

// Locale-independent fields (names, counts, category slugs) are asserted from
// one snapshot; localized fields (titles, descriptions, tags) are asserted per
// locale. The Featured projects grid is its own curated list, independent of
// the technologist dialogs.
const projects = featuredProjectsOf()
const technologists = technologistsOf('en')

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
    const response = await page.goto('/forward-deployed-creatives')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'en'))
  })

  test('hero renders the h1 and CTA pair with decided hrefs', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'en')
    )
    const hero = page.locator('section', {
      has: page.getByRole('heading', { level: 1 })
    })
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.contactCta', 'en') })
    ).toHaveAttribute('href', '/contact')
    await expect(page.getByText(t('fdct.hero.eyebrow', 'en'))).toBeVisible()
  })

  test('builders section renders the node label, reasons, and marquee', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
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
    await page.goto('/forward-deployed-creatives')
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
    await page.goto('/forward-deployed-creatives')
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

  test('opens a technologist dialog with their workflow cards and closes on Escape', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
    // Chris V.'s workflows render only inside his bio dialog, so this is the
    // suite's only coverage of the dialog + its CardWorkflow01 grid.
    const person = technologists.find((t) => t.name === 'Chris V.')!
    const personWorkflows = hubProjectsOf('en').filter(
      (project) => project.author.name === person.name
    )
    expect(personWorkflows.length).toBeGreaterThan(0)

    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.technologists.title', 'en')
      })
    })
    const seeWork = t('fdct.technologists.seeWork', 'en').replace(
      '{name}',
      person.nickname ?? person.name.split(' ')[0]
    )
    const trigger = section.getByRole('button', { name: seeWork })
    const dialog = page.getByRole('dialog')
    // reka-ui server-renders the trigger, so a click can land before the island
    // hydrates and be a no-op. Retry the open only while the dialog is still
    // closed (the trigger toggles, so an unconditional re-click could close it).
    await expect(async () => {
      if (!(await dialog.isVisible())) await trigger.click()
      await expect(dialog).toBeVisible({ timeout: 1000 })
    }).toPass()
    await expect(
      dialog.getByRole('heading', { name: person.name })
    ).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: personWorkflows[0].title })
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('past projects renders six unlinked cards with tags', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: t('fdct.projects.title', 'en') })
    })
    for (const project of projects) {
      await expect(
        section.getByText(project.title, { exact: true })
      ).toHaveCount(1)
    }
    for (const tag of projects[1].tags) {
      await expect(
        section.getByText(tag, { exact: true }).first()
      ).toBeVisible()
    }
    // The featured cards deliberately carry no workflow links.
    await expect(section.locator('a')).toHaveCount(0)
  })

  test('Q&A renders five questions and expands one to reveal its answer', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
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
    await page.goto('/forward-deployed-creatives')
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
      mainEntity?: { name: string; acceptedAnswer: { text: string } }[]
    }[]
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node in @graph').toBeDefined()
    const faqs = fdctFaqs('en')
    expect(faqPage!.mainEntity!.map((entity) => entity.name)).toEqual(
      faqs.map((faq) => faq.question)
    )
    expect(
      faqPage!.mainEntity!.map((entity) => entity.acceptedAnswer.text)
    ).toEqual(faqs.map((faq) => faqAnswerPlainText(faq.answer)))
  })

  test('CTA band renders the enterprise label with the decided href', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
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
      section.getByRole('link', { name: t('fdct.bands.enterprise.cta', 'en') })
    ).toHaveAttribute('href', '/contact')
    await expect(
      section.getByRole('heading', { name: 'FOR CREATORS' })
    ).toHaveCount(0)
  })
})

test.describe('FDCT hero @mobile', () => {
  test('shows the eyebrow and the click-to-play hero video', async ({
    page
  }) => {
    await page.goto('/forward-deployed-creatives')
    await expect(page.getByText(t('fdct.hero.eyebrow', 'en'))).toBeVisible()
    // The hero video rests on its poster and only plays on demand.
    const video = page.getByLabel(t('fdct.hero.title', 'en'))
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('poster', /FDCT_V4_thumb/)
    await expect(video).not.toHaveAttribute('autoplay')
    await expect(
      page.getByRole('button', { name: t('player.play', 'en') })
    ).toBeVisible()
    const hero = page.locator('section', {
      has: page.getByRole('heading', { level: 1 })
    })
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.contactCta', 'en') })
    ).toBeVisible()
  })
})

test.describe('FDCT page (zh-CN) @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/zh-CN/forward-deployed-creatives')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'zh-CN'))
  })

  test('hero renders the localized h1 and locale-prefixed contact CTA', async ({
    page
  }) => {
    await page.goto('/zh-CN/forward-deployed-creatives')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'zh-CN')
    )
    const hero = page.locator('section', {
      has: page.getByRole('heading', { level: 1 })
    })
    await expect(
      hero.getByRole('link', { name: t('fdct.hero.contactCta', 'zh-CN') })
    ).toHaveAttribute('href', '/zh-CN/contact')
  })

  test('builders section renders the localized node label and reasons', async ({
    page
  }) => {
    await page.goto('/zh-CN/forward-deployed-creatives')
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
    await page.goto('/zh-CN/forward-deployed-creatives')
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
    await page.goto('/zh-CN/forward-deployed-creatives')
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
    await page.goto('/zh-CN/forward-deployed-creatives')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.projects.title', 'zh-CN')
      })
    })
    // Titles are localized, so assert the zh-CN copy renders (not the en list).
    const localizedProjects = featuredProjectsOf('zh-CN')
    for (const project of localizedProjects) {
      await expect(
        section.getByText(project.title, { exact: true })
      ).toHaveCount(1)
    }
    await expect(
      section.getByText(localizedProjects[0].tags[0], { exact: true }).first()
    ).toBeVisible()
  })

  test('Q&A renders the five localized questions and expands one', async ({
    page
  }) => {
    await page.goto('/zh-CN/forward-deployed-creatives')
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

  test('CTA band renders the localized label with a locale-prefixed href', async ({
    page
  }) => {
    await page.goto('/zh-CN/forward-deployed-creatives')
    const section = page.locator('section', {
      has: page.getByRole('heading', {
        name: t('fdct.bands.enterprise.label', 'zh-CN')
      })
    })
    await expect(
      section.getByRole('heading', {
        name: t('fdct.bands.enterprise.label', 'zh-CN')
      })
    ).toBeVisible()
    await expect(
      section.getByRole('link', {
        name: t('fdct.bands.enterprise.cta', 'zh-CN')
      })
    ).toHaveAttribute('href', '/zh-CN/contact')
  })
})
