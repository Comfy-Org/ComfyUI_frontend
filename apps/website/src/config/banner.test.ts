import { describe, expect, it } from 'vitest'

import { evaluateBannerVisibility } from '@/utils/banner'

import { challengeBannerConfig, getBannerData } from './banner'

describe('challengeBannerConfig', () => {
  it('links to the details in a new tab with campaign tracking', () => {
    const { link } = getBannerData(challengeBannerConfig, 'en')
    const params = new URLSearchParams(link?.href.split('?')[1])

    expect(Object.fromEntries(params)).toEqual({
      utm_source: 'comfy_org',
      utm_medium: 'website',
      utm_campaign: 'dev_platform_challenge',
      utm_content: 'platform_strip_details'
    })
    expect(link).toMatchObject({
      title: 'Read the post',
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  })

  it.for([
    { now: '2026-10-19T23:59:00-07:00', visible: true },
    { now: '2026-10-20T00:01:00-07:00', visible: false }
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
