import { describe, expect, it } from 'vitest'

import { minimaxPage } from '../../data/minimax'
import { t } from '../../i18n/translations'
import type { ModelLaunchPage } from './types'

// Add every new launch-page config here so it inherits these checks.
const pages: { name: string; page: ModelLaunchPage }[] = [
  { name: 'minimax', page: minimaxPage }
]

describe.each(pages)('$name launch page config', ({ page }) => {
  it('gives every gallery card a unique id', () => {
    const ids = page.gallery.cards.map((card) => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('translates every referenced key in both locales', () => {
    const keys = [
      page.metaTitleKey,
      page.metaDescriptionKey,
      page.breadcrumbLabelKey,
      page.breadcrumbUpdatedKey,
      page.hero.titleKey,
      page.hero.descriptionKey,
      page.hero.primaryCta.labelKey,
      page.gallery.headingKey,
      page.faq.headingKey,
      page.closingCta.headingKey,
      page.closingCta.primaryCta.labelKey,
      page.runOptions.headingKey,
      page.runOptions.subtitleKey,
      page.runOptions.ctaKey,
      page.reviews.headingKey,
      page.reviews.highlight.titleKey,
      page.reviews.highlight.descriptionKey,
      page.reviews.highlight.ctaKey
    ]
    for (const key of keys) {
      expect(t(key, 'en'), `${key} (en)`).not.toBe('')
      expect(t(key, 'zh-CN'), `${key} (zh-CN)`).not.toBe('')
    }
  })

  it('localizes every gallery card and FAQ entry in both locales', () => {
    for (const card of page.gallery.cards) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(card.name[locale], `${card.id} name`).not.toBe('')
        expect(card.note[locale], `${card.id} note`).not.toBe('')
        expect(card.description[locale], `${card.id} description`).not.toBe('')
      }
    }
    for (const faq of page.faq.items) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(faq.question[locale], `${faq.id} question`).not.toBe('')
        expect(faq.answer[locale], `${faq.id} answer`).not.toBe('')
      }
    }
  })

  it('points every outbound link at an absolute url', () => {
    const hrefs = [
      page.hero.primaryCta.href,
      page.hero.secondaryCta?.href,
      page.closingCta.primaryCta.href,
      page.closingCta.secondaryCta?.href,
      page.pricing.banner?.cta.href,
      ...page.gallery.cards.map((card) => card.href)
    ].filter((href): href is string => href !== undefined)

    for (const href of hrefs) {
      expect(href, href).toMatch(/^https:\/\//)
    }
  })

  it('serves gallery media that the card can actually render', () => {
    for (const card of page.gallery.cards) {
      expect(card.mediaSrc, card.id).toMatch(
        /^https:\/\/media\.comfy\.org\/.+\.(webm|webp|png|jpg)$/
      )
    }
  })
})
