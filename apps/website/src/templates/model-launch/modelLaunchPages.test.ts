import { describe, expect, it } from 'vitest'

import { chatgptImage25Page } from '@/data/chatgptImage25'
import { flux3Page } from '@/data/flux3'
import { geminiOmniPage } from '@/data/geminiOmni'
import { ltxPage } from '@/data/ltx'
import { minimaxPage } from '@/data/minimax'
import { minimaxLicensePage } from '@/data/minimaxLicense'
import {
  qwenImage21AnnouncementPage,
  qwenImage21Page
} from '@/data/qwenImage21'
import { minimaxMusic3Page } from '@/data/minimaxMusic3'
import { nanoBananaPage } from '@/data/nanoBanana'
import { seedancePage } from '@/data/seedance'
import { wanAnimate2Page } from '@/data/wanAnimate2'
import { wan3Page } from '@/data/wan3'
import type { LocalizedText, TranslationKey } from '@/i18n/translations'
import { t } from '@/i18n/translations'
import { DEFAULT_SECTION_ORDER } from './types'
import type {
  ModelLaunchAudioCard,
  ModelLaunchClosingCta,
  ModelLaunchComparison,
  ModelLaunchFaqSection,
  ModelLaunchGallery,
  ModelLaunchHero,
  ModelLaunchHighlight,
  ModelLaunchPage,
  ModelLaunchPricing,
  ModelLaunchShowcase,
  ModelLaunchSteps
} from './types'

// Add every new launch-page config here so it inherits these checks.
const pages: { name: string; page: ModelLaunchPage }[] = [
  { name: 'minimax', page: minimaxPage },
  { name: 'minimaxMusic3', page: minimaxMusic3Page },
  { name: 'minimaxLicense', page: minimaxLicensePage },
  { name: 'flux3', page: flux3Page },
  { name: 'chatgptImage25', page: chatgptImage25Page },
  { name: 'qwenImage21', page: qwenImage21Page },
  { name: 'qwenImage21Announcement', page: qwenImage21AnnouncementPage },
  { name: 'nanoBanana', page: nanoBananaPage },
  { name: 'seedance', page: seedancePage },
  { name: 'ltx', page: ltxPage },
  { name: 'geminiOmni', page: geminiOmniPage },
  { name: 'wanAnimate2', page: wanAnimate2Page },
  { name: 'wan3', page: wan3Page }
]

const VIDEO_URL =
  /^(https:\/\/media\.comfy\.org\/|\/(?!\/))[\w./-]+\.(webm|mp4)$/
const IMAGE_URL =
  /^(https:\/\/media\.comfy\.org\/|\/(?!\/))[\w./-]+\.(webp|png|jpe?g)$/
const AUDIO_URL = /^https:\/\/media\.comfy\.org\/.+\.(mp3|flac|m4a|ogg)$/
const HERO_STILL_URL =
  /^(https:\/\/media\.comfy\.org\/|\/(?!\/))[\w./-]+\.(webp|png|jpe?g)$/
const LOCALES = ['en', 'zh-CN'] as const

type MaybeKey = TranslationKey | undefined

function heroKeys(hero: ModelLaunchHero): MaybeKey[] {
  return [
    hero.eyebrowKey,
    hero.titleKey,
    hero.titleRestKey,
    hero.descriptionKey,
    hero.mobileDescriptionKey,
    hero.primaryCta?.labelKey,
    hero.secondaryCta?.labelKey,
    hero.promptBar?.sampleKey,
    hero.promptBar?.cta.labelKey,
    ...(hero.badgeKeys ?? [])
  ]
}

function showcaseKeys(showcases: readonly ModelLaunchShowcase[]): MaybeKey[] {
  return showcases.flatMap((showcase) => [
    showcase.headingKey,
    showcase.cta?.labelKey,
    showcase.descriptionKey
  ])
}

function pricingKeys(pricing: ModelLaunchPricing | undefined): MaybeKey[] {
  const banner = pricing?.banner
  return [banner?.titleKey, banner?.subtitleKey, banner?.cta.labelKey]
}

function stepsKeys(steps: ModelLaunchSteps | undefined): MaybeKey[] {
  return [
    steps?.headingKey,
    steps?.stepLabelKey,
    steps?.primaryCta?.labelKey,
    steps?.secondaryCta?.labelKey
  ]
}

function closingCtaKeys(
  closingCta: ModelLaunchClosingCta | undefined
): MaybeKey[] {
  return [
    closingCta?.headingKey,
    closingCta?.primaryCta.labelKey,
    closingCta?.secondaryCta?.labelKey
  ]
}

function highlightKeys(
  highlight: ModelLaunchHighlight | undefined
): MaybeKey[] {
  return [highlight?.titleKey, highlight?.descriptionKey, highlight?.ctaKey]
}

// Every key the ModelLaunchPage contract can render, optional ones included.
function pageKeys(page: ModelLaunchPage): TranslationKey[] {
  return [
    page.metaTitleKey,
    page.metaDescriptionKey,
    page.breadcrumbLabelKey,
    page.breadcrumbUpdatedKey,
    ...heroKeys(page.hero),
    ...showcaseKeys(page.showcases ?? []),
    page.gallery?.headingKey,
    ...pricingKeys(page.pricing),
    page.faq?.headingKey,
    page.comparison?.headingKey,
    ...stepsKeys(page.steps),
    ...closingCtaKeys(page.closingCta),
    page.runOptions.headingKey,
    page.runOptions.subtitleKey,
    page.runOptions.ctaKey,
    page.reviews.headingKey,
    ...highlightKeys(page.reviews.highlight),
    ...highlightKeys(page.highlight)
  ].filter((key): key is TranslationKey => key !== undefined)
}

function expectTranslated(key: TranslationKey) {
  for (const locale of LOCALES) {
    expect(t(key, {}, { locale }), `${key} (${locale})`).not.toBe('')
  }
}

function expectLocalized(text: LocalizedText, id: string, field: string) {
  for (const locale of LOCALES) {
    expect(text[locale] || text.en, `${id} ${field}`).not.toBe('')
  }
}

function expectLocalizedWithoutFallback(
  text: LocalizedText,
  id: string,
  field: string
) {
  for (const locale of LOCALES) {
    expect(text[locale], `${id} ${field}`).not.toBe('')
  }
}

function expectShowcaseCardsLocalized(
  showcases: readonly ModelLaunchShowcase[]
) {
  for (const card of showcases.flatMap((showcase) => showcase.cards)) {
    expectLocalized(card.alt, card.id, 'alt')
  }
}

function expectGalleryCardsLocalized(cards: ModelLaunchGallery['cards']) {
  for (const card of cards) {
    expectLocalized(card.name, card.id, 'name')
    expectLocalized(card.note, card.id, 'note')
    expectLocalized(card.description, card.id, 'description')
  }
}

function expectAudioCardsLocalized(cards: readonly ModelLaunchAudioCard[]) {
  for (const card of cards) {
    expectLocalized(card.description, card.id, 'description')
    expectLocalized(card.prompt, card.id, 'prompt')
  }
}

function expectComparisonLocalized(
  comparison: ModelLaunchComparison | undefined
) {
  if (comparison === undefined) return
  // Empty columns/rows would render an empty table while every loop below
  // runs zero times and passes.
  expect(comparison.columns, 'comparison columns').not.toHaveLength(0)
  expect(comparison.rows, 'comparison rows').not.toHaveLength(0)
  for (const column of comparison.columns) {
    expectLocalizedWithoutFallback(column.label, column.id, 'column label')
  }
  for (const row of comparison.rows) {
    // A short row would silently render an empty cell under the last column.
    expect(row.cells.length, `${row.id} cell count`).toBe(
      comparison.columns.length
    )
    expectLocalizedWithoutFallback(row.label, row.id, 'label')
    for (const [index, cell] of row.cells.entries()) {
      expectLocalizedWithoutFallback(cell, row.id, `cell ${index}`)
    }
  }
}

function expectFaqLocalized(items: ModelLaunchFaqSection['items']) {
  for (const faq of items) {
    expectLocalized(faq.question, faq.id, 'question')
    expectLocalized(faq.answer, faq.id, 'answer')
  }
}

function heroHrefs(hero: ModelLaunchHero): (string | undefined)[] {
  return [
    hero.primaryCta?.href,
    hero.secondaryCta?.href,
    hero.promptBar?.cta.href
  ]
}

function sectionCtaHrefs(page: ModelLaunchPage): (string | undefined)[] {
  return [
    page.closingCta?.primaryCta.href,
    page.closingCta?.secondaryCta?.href,
    page.steps?.primaryCta?.href,
    page.steps?.secondaryCta?.href,
    page.pricing?.banner?.cta.href
  ]
}

function outboundHrefs(page: ModelLaunchPage): string[] {
  return [
    ...heroHrefs(page.hero),
    ...sectionCtaHrefs(page),
    ...(page.gallery?.cards.map((card) => card.href) ?? []),
    ...(page.showcases ?? []).map((showcase) => showcase.cta?.href)
  ].filter((href): href is string => href !== undefined)
}

function expectHeroStills(hero: ModelLaunchHero) {
  if (hero.videoSrc !== undefined) {
    expect(hero.videoSrc).toMatch(VIDEO_URL)
  }
  if (hero.posterSrc !== undefined) {
    expect(hero.posterSrc).toMatch(HERO_STILL_URL)
  }
  if (hero.placeholderImageSrc !== undefined) {
    expect(hero.placeholderImageSrc).toMatch(HERO_STILL_URL)
  }
  if (hero.mobileFallbackImageSrc !== undefined) {
    expect(hero.mobileFallbackImageSrc).toMatch(HERO_STILL_URL)
  }
}

function expectStepsLocalized(items: ModelLaunchSteps['items']) {
  for (const step of items) {
    expectLocalized(step.title, step.id, 'title')
    if (step.description !== undefined) {
      expectLocalized(step.description, step.id, 'description')
    }
  }
}

describe.for(pages)('$name launch page config', ({ page }) => {
  it('gives every gallery card a unique id', () => {
    const ids = [
      ...(page.showcases ?? []).flatMap((s) => s.cards.map((card) => card.id)),
      ...(page.gallery?.cards.map((card) => card.id) ?? []),
      ...(page.audioGallery?.cards.map((card) => card.id) ?? [])
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('translates every referenced key in both locales', () => {
    for (const key of pageKeys(page)) {
      expectTranslated(key)
    }
  })

  it('localizes every gallery card and FAQ entry in both locales', () => {
    expectShowcaseCardsLocalized(page.showcases ?? [])
    expectGalleryCardsLocalized(page.gallery?.cards ?? [])
    expectAudioCardsLocalized(page.audioGallery?.cards ?? [])
    expectComparisonLocalized(page.comparison)
    expectFaqLocalized(page.faq?.items ?? [])
    expectStepsLocalized(page.steps?.items ?? [])
  })

  it('points every outbound link at an absolute url', () => {
    const hrefs = outboundHrefs(page)

    expect(hrefs.filter((href) => !href.startsWith('https://'))).toEqual([])
  })

  it('serves media matching its declared kind', () => {
    expectHeroStills(page.hero)

    // Collected rather than asserted per card so a failure names the offenders.
    const offenders = (page.gallery?.cards ?? []).filter((card) =>
      card.media.kind === 'video'
        ? !VIDEO_URL.test(card.media.src) ||
          (card.media.posterSrc !== undefined &&
            !IMAGE_URL.test(card.media.posterSrc))
        : !IMAGE_URL.test(card.media.src)
    )

    expect(offenders.map((card) => card.id)).toEqual([])

    const showcaseOffenders = (page.showcases ?? [])
      .flatMap((showcase) => showcase.cards)
      .filter((card) => !IMAGE_URL.test(card.src))

    expect(showcaseOffenders.map((card) => card.id)).toEqual([])

    const audioOffenders = (page.audioGallery?.cards ?? []).filter(
      (card) =>
        card.audioSources.length === 0 ||
        card.audioSources.some((source) => !AUDIO_URL.test(source.src)) ||
        !IMAGE_URL.test(card.posterSrc)
    )

    expect(audioOffenders.map((card) => card.id)).toEqual([])
  })

  it('orders every optional section it defines', () => {
    const order = page.sectionOrder ?? DEFAULT_SECTION_ORDER
    // A defined section left out of the order would silently not render.
    const dropped = DEFAULT_SECTION_ORDER.filter(
      (section) => page[section] !== undefined && !order.includes(section)
    )

    expect(dropped).toEqual([])
  })

  it('lists a playable MP3 first in every audio source list', () => {
    const offenders = (page.audioGallery?.cards ?? []).filter(
      (card) => card.audioSources[0]?.type !== 'audio/mpeg'
    )

    expect(offenders.map((card) => card.id)).toEqual([])
  })
})
