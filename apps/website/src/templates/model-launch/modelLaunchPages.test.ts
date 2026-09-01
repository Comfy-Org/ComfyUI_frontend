import { describe, expect, it } from 'vitest'

import { flux3Page } from '../../data/flux3'
import { geminiOmniPage } from '../../data/geminiOmni'
import { ltxPage } from '../../data/ltx'
import { minimaxPage } from '../../data/minimax'
import { minimaxLicensePage } from '../../data/minimaxLicense'
import { minimaxMusic3Page } from '../../data/minimaxMusic3'
import { seedancePage } from '../../data/seedance'
import { wanAnimate2Page } from '../../data/wanAnimate2'
import { wan3Page } from '../../data/wan3'
import type { TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { DEFAULT_SECTION_ORDER } from './types'
import type { ModelLaunchPage } from './types'

// Add every new launch-page config here so it inherits these checks.
const pages: { name: string; page: ModelLaunchPage }[] = [
  { name: 'minimax', page: minimaxPage },
  { name: 'minimaxMusic3', page: minimaxMusic3Page },
  { name: 'minimaxLicense', page: minimaxLicensePage },
  { name: 'flux3', page: flux3Page },
  { name: 'seedance', page: seedancePage },
  { name: 'ltx', page: ltxPage },
  { name: 'geminiOmni', page: geminiOmniPage },
  { name: 'wanAnimate2', page: wanAnimate2Page },
  { name: 'wan3', page: wan3Page }
]

const VIDEO_URL = /^https:\/\/media\.comfy\.org\/.+\.(webm|mp4)$/
const IMAGE_URL = /^https:\/\/media\.comfy\.org\/.+\.(webp|png|jpe?g)$/
const AUDIO_URL = /^https:\/\/media\.comfy\.org\/.+\.(mp3|flac|m4a|ogg)$/
// Hero stills may ship from public/ as a root-relative path; the hero video
// must be on the CDN.
const HERO_STILL_URL =
  /^(https:\/\/media\.comfy\.org\/|\/)[\w./-]+\.(webp|png|jpe?g)$/

describe.for(pages)('$name launch page config', ({ page }) => {
  it('gives every gallery card a unique id', () => {
    const ids = [
      ...(page.gallery?.cards.map((card) => card.id) ?? []),
      ...(page.audioGallery?.cards.map((card) => card.id) ?? [])
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('translates every referenced key in both locales', () => {
    // Every key the ModelLaunchPage contract can render, optional ones included.
    const keys = [
      page.metaTitleKey,
      page.metaDescriptionKey,
      page.breadcrumbLabelKey,
      page.breadcrumbUpdatedKey,
      page.hero.eyebrowKey,
      page.hero.titleKey,
      page.hero.titleRestKey,
      page.hero.descriptionKey,
      page.hero.primaryCta?.labelKey,
      page.hero.secondaryCta?.labelKey,
      page.hero.promptBar?.sampleKey,
      page.hero.promptBar?.cta.labelKey,
      ...(page.hero.badgeKeys ?? []),
      page.gallery?.headingKey,
      page.pricing?.banner?.titleKey,
      page.pricing?.banner?.subtitleKey,
      page.pricing?.banner?.cta.labelKey,
      page.faq?.headingKey,
      page.steps?.headingKey,
      page.steps?.stepLabelKey,
      page.steps?.primaryCta?.labelKey,
      page.steps?.secondaryCta?.labelKey,
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
        expect(card.name[locale], `${card.id} name`).not.toBe('')
        expect(card.note[locale], `${card.id} note`).not.toBe('')
        expect(card.description[locale], `${card.id} description`).not.toBe('')
      }
    }
    for (const card of page.audioGallery?.cards ?? []) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(card.description[locale], `${card.id} description`).not.toBe('')
        expect(card.prompt[locale], `${card.id} prompt`).not.toBe('')
      }
    }
    for (const faq of page.faq?.items ?? []) {
      for (const locale of ['en', 'zh-CN'] as const) {
        expect(faq.question[locale], `${faq.id} question`).not.toBe('')
        expect(faq.answer[locale], `${faq.id} answer`).not.toBe('')
      }
    }
  })

  it('points every outbound link at an absolute url', () => {
    const hrefs = [
      page.hero.primaryCta?.href,
      page.hero.secondaryCta?.href,
      page.closingCta?.primaryCta.href,
      page.closingCta?.secondaryCta?.href,
      page.steps?.primaryCta?.href,
      page.steps?.secondaryCta?.href,
      page.hero.promptBar?.cta.href,
      page.pricing?.banner?.cta.href,
      ...(page.gallery?.cards.map((card) => card.href) ?? [])
    ].filter((href): href is string => href !== undefined)

    expect(hrefs.filter((href) => !href.startsWith('https://'))).toEqual([])
  })

  it('serves media matching its declared kind', () => {
    if (page.hero.videoSrc !== undefined) {
      expect(page.hero.videoSrc).toMatch(VIDEO_URL)
    }
    if (page.hero.posterSrc !== undefined) {
      expect(page.hero.posterSrc).toMatch(HERO_STILL_URL)
    }
    if (page.hero.placeholderImageSrc !== undefined) {
      expect(page.hero.placeholderImageSrc).toMatch(HERO_STILL_URL)
    }
    if (page.hero.mobileFallbackImageSrc !== undefined) {
      expect(page.hero.mobileFallbackImageSrc).toMatch(HERO_STILL_URL)
    }

    // Collected rather than asserted per card so a failure names the offenders.
    const offenders = (page.gallery?.cards ?? []).filter((card) =>
      card.media.kind === 'video'
        ? !VIDEO_URL.test(card.media.src) ||
          (card.media.posterSrc !== undefined &&
            !IMAGE_URL.test(card.media.posterSrc))
        : !IMAGE_URL.test(card.media.src)
    )

    expect(offenders.map((card) => card.id)).toEqual([])

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
