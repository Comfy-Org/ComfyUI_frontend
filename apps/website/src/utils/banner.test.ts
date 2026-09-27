import { describe, expect, it } from 'vitest'

import type { EvaluableBanner } from './banner'

import { createBannerVersion, evaluateBannerVisibility } from './banner'

const base: EvaluableBanner = {
  isActive: true,
  targetSections: ['sitewide']
}

const ctx = {
  currentLocale: 'en',
  currentSection: 'sitewide',
  now: new Date('2026-07-06T00:00:00Z')
}

describe('evaluateBannerVisibility', () => {
  it('shows an active, untargeted, sitewide banner', () => {
    expect(evaluateBannerVisibility(base, ctx)).toBe(true)
  })

  it('hides when inactive', () => {
    expect(evaluateBannerVisibility({ ...base, isActive: false }, ctx)).toBe(
      false
    )
  })

  it('hides before startsAt and shows within the window', () => {
    expect(
      evaluateBannerVisibility(
        { ...base, startsAt: '2026-07-10T00:00:00Z' },
        ctx
      )
    ).toBe(false)
    expect(
      evaluateBannerVisibility(
        { ...base, startsAt: '2026-07-01T00:00:00Z' },
        ctx
      )
    ).toBe(true)
  })

  it('hides after endsAt', () => {
    expect(
      evaluateBannerVisibility({ ...base, endsAt: '2026-07-01T00:00:00Z' }, ctx)
    ).toBe(false)
    expect(
      evaluateBannerVisibility({ ...base, endsAt: '2026-07-10T00:00:00Z' }, ctx)
    ).toBe(true)
  })

  it('treats an empty targetLocales as "all locales"', () => {
    expect(evaluateBannerVisibility({ ...base, targetLocales: [] }, ctx)).toBe(
      true
    )
  })

  it('hides when targetLocales excludes the current locale', () => {
    expect(
      evaluateBannerVisibility({ ...base, targetLocales: ['zh-CN'] }, ctx)
    ).toBe(false)
    expect(
      evaluateBannerVisibility({ ...base, targetLocales: ['en', 'zh-CN'] }, ctx)
    ).toBe(true)
  })

  it('hides when targetSections does not include the current section', () => {
    expect(
      evaluateBannerVisibility({ ...base, targetSections: ['checkout'] }, ctx)
    ).toBe(false)
  })

  it('hides when targetSections is absent (nothing to match)', () => {
    expect(evaluateBannerVisibility({ isActive: true }, ctx)).toBe(false)
  })
})

describe('createBannerVersion', () => {
  const content = {
    id: 'announcement',
    title: 'Join the live stream',
    link: { href: 'https://x', title: 'Join' }
  }

  it('is deterministic for identical content', () => {
    expect(createBannerVersion(content, 'en')).toBe(
      createBannerVersion(content, 'en')
    )
  })

  it('encodes the banner id and locale in the key', () => {
    expect(createBannerVersion(content, 'en')).toMatch(
      /^announcement_en_v-?\d+$/
    )
  })

  it('changes when the copy changes', () => {
    expect(createBannerVersion(content, 'en')).not.toBe(
      createBannerVersion({ ...content, title: 'New copy' }, 'en')
    )
  })

  it('differs per locale so one locale edit does not re-show another', () => {
    expect(createBannerVersion(content, 'en')).not.toBe(
      createBannerVersion(content, 'zh-CN')
    )
  })
})
