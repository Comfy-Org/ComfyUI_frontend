import { describe, expect, it } from 'vitest'

import type { TranslationKey } from '../i18n/translations'
import { t } from '../i18n/translations'
import { chatgptImage25Page as page } from './chatgptImage25'

// chatgptImage25Page is deliberately excluded from modelLaunchPages.test.ts
// (its gallery uses local placeholder images, not media.comfy.org), so it
// doesn't inherit that suite's i18n-completeness and gallery checks. Cover
// the same ground here instead of leaving it untested.

describe('chatgpt-image-2.5 launch page', () => {
  it('gives every gallery card a unique id', () => {
    const ids = page.gallery?.cards.map((card) => card.id) ?? []
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('points every gallery card at a local placeholder, not a fabricated CDN path', () => {
    for (const card of page.gallery?.cards ?? []) {
      expect(card.media.kind).toBe('image')
      expect(card.media.src).toMatch(/^\/images\/.+\.(png|webp|jpe?g)$/)
    }
  })

  it('translates every referenced key in both locales', () => {
    const keys = [
      page.metaTitleKey,
      page.metaDescriptionKey,
      page.breadcrumbLabelKey,
      page.breadcrumbUpdatedKey,
      page.hero.eyebrowKey,
      page.hero.titleKey,
      page.hero.descriptionKey,
      page.hero.primaryCta?.labelKey,
      page.hero.secondaryCta?.labelKey,
      ...(page.hero.badgeKeys ?? []),
      page.gallery?.headingKey,
      page.pricing?.banner?.titleKey,
      page.pricing?.banner?.subtitleKey,
      page.pricing?.banner?.cta.labelKey,
      page.faq?.headingKey,
      page.closingCta?.headingKey,
      page.closingCta?.primaryCta.labelKey,
      page.closingCta?.secondaryCta?.labelKey,
      page.runOptions.headingKey,
      page.runOptions.subtitleKey,
      page.runOptions.ctaKey,
      page.reviews.headingKey,
      page.reviews.highlight.titleKey,
      page.reviews.highlight.descriptionKey,
      page.reviews.highlight.ctaKey
    ].filter((key): key is TranslationKey => key !== undefined)

    for (const key of keys) {
      expect(t(key, 'en'), `${key} (en)`).not.toBe('')
      expect(t(key, 'zh-CN'), `${key} (zh-CN)`).not.toBe('')
    }
  })

  it('localizes every gallery card and FAQ entry in both locales', () => {
    for (const card of page.gallery?.cards ?? []) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(card.name[locale] || card.name.en, `${card.id} name`).not.toBe(
          ''
        )
        expect(card.note[locale] || card.note.en, `${card.id} note`).not.toBe(
          ''
        )
        expect(
          card.description[locale] || card.description.en,
          `${card.id} description`
        ).not.toBe('')
      }
    }
    for (const faq of page.faq?.items ?? []) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(
          faq.question[locale] || faq.question.en,
          `${faq.id} question`
        ).not.toBe('')
        expect(
          faq.answer[locale] || faq.answer.en,
          `${faq.id} answer`
        ).not.toBe('')
      }
    }
  })

  it('points every outbound CTA link at an absolute url', () => {
    const hrefs = [
      page.hero.primaryCta?.href,
      page.hero.secondaryCta?.href,
      page.closingCta?.primaryCta.href,
      page.closingCta?.secondaryCta?.href,
      page.pricing?.banner?.cta.href,
      ...(page.gallery?.cards.map((card) => card.href) ?? [])
    ].filter((href): href is string => href !== undefined)

    expect(hrefs.filter((href) => !href.startsWith('https://'))).toEqual([])
  })
})
