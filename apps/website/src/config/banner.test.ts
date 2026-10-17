import { describe, expect, it } from 'vitest'

import { evaluateBannerVisibility } from '@/utils/banner'

import {
  activeBannerFor,
  bannerConfig,
  challengeBannerConfig,
  getBannerData
} from './banner'

describe('challengeBannerConfig', () => {
  it.for([
    { locale: 'en', href: '/open-source-higgsfield/' },
    { locale: 'zh-CN', href: '/zh-CN/open-source-higgsfield/' }
  ] as const)(
    'links $locale visitors to the challenge page in the same tab',
    ({ locale, href }) => {
      expect(getBannerData(challengeBannerConfig, locale).link).toMatchObject({
        href,
        target: undefined
      })
    }
  )

  it.for([
    { now: '2026-10-30T08:59:00-07:00', visible: true },
    { now: '2026-10-30T09:01:00-07:00', visible: false }
  ])('has visibility $visible at $now', ({ now, visible }) => {
    expect(
      evaluateBannerVisibility(challengeBannerConfig, {
        currentLocale: 'en',
        currentSection: 'sitewide',
        now: new Date(now)
      })
    ).toBe(visible)
  })
})

describe('activeBannerFor', () => {
  const ctxAt = (now: string) => ({
    currentLocale: 'en',
    currentSection: 'sitewide',
    now: new Date(now)
  })

  it.for([
    {
      name: 'a page banner wins over the sitewide banner while it runs',
      page: challengeBannerConfig,
      now: '2026-10-30T08:59:00-07:00',
      expected: challengeBannerConfig
    },
    {
      name: 'a page banner falls back to the sitewide banner once it ends',
      page: challengeBannerConfig,
      now: '2026-10-30T09:01:00-07:00',
      expected: bannerConfig
    },
    {
      name: '/events shows the challenge banner while it runs',
      page: challengeBannerConfig,
      now: '2026-10-30T08:59:00-07:00',
      expected: challengeBannerConfig
    },
    {
      name: '/events shows the sitewide banner once the challenge ends',
      page: challengeBannerConfig,
      now: '2026-10-30T09:01:00-07:00',
      expected: bannerConfig
    },
    {
      name: 'a page without its own banner shows the sitewide banner',
      page: undefined,
      now: '2026-10-30T08:59:00-07:00',
      expected: bannerConfig
    }
  ])('$name', ({ page, now, expected }) => {
    expect(activeBannerFor(page, ctxAt(now))).toBe(expected)
  })
})
