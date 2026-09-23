import { describe, expect, it } from 'vitest'

import { bannerConfig, getBannerData } from './banner'

// Spelled out rather than resolved through the config: every other banner test
// reads the same source the page does, so only literals catch a wrong edit to
// the approved copy or to the page the CTA is meant to open.
describe('the live sitewide banner campaign', () => {
  it.for([
    [
      'en',
      'One API for frontier media models.',
      'Start Comfy Router',
      '/platform/router'
    ],
    [
      'zh-CN',
      '前沿媒体模型，尽在一个 API。',
      '启动 Comfy Router',
      '/zh-CN/platform/router'
    ]
  ] as const)('promotes Comfy Router in %s', ([locale, title, cta, href]) => {
    const banner = getBannerData(bannerConfig, locale)

    expect(banner.title).toBe(title)
    expect(banner.link?.title).toBe(cta)
    expect(banner.link?.href).toBe(href)
  })
})
