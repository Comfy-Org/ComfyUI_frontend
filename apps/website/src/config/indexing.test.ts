import { describe, expect, it, vi } from 'vitest'
import { isExcludedFromSitemap, isNoindexPathname } from './indexing'

describe('indexing policy', () => {
  it.for(['0', '1'])(
    'excludes retired Workshop in either build (%s)',
    (value) => {
      vi.stubEnv('WORKSHOP_IN_BUILD', value)
      expect(isExcludedFromSitemap('https://comfy.org/workshop/')).toBe(true)
      expect(
        isExcludedFromSitemap('https://comfy.org/workshop/models/example/')
      ).toBe(true)
    }
  )

  it('excludes only the disabled Workshop route tree', () => {
    vi.stubEnv('WORKSHOP_IN_BUILD', '0')
    expect(
      isExcludedFromSitemap('https://comfy.org/workshop/models/example/')
    ).toBe(true)
    expect(isExcludedFromSitemap('https://comfy.org/workshops/')).toBe(false)
  })

  it.for([
    '/privacy-policy',
    '/privacy-policy/',
    '/zh-CN/privacy-policy',
    '/terms-of-service',
    '/zh-CN/terms-of-service/',
    '/payment/success',
    '/zh-CN/payment/failed/',
    '/individual-submission',
    '/zh-CN/booking-confirmation/',
    '/case-studies',
    '/zh-CN/videos/',
    '/demos',
    '/login',
    '/signup',
    '/forgot-password',
    '/zh-CN/login'
  ])('marks %s as noindex', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(true)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(true)
  })

  it.for([
    '/privacy',
    '/pricing',
    '/p/supported-models/grok-imagine',
    '/demos/image-to-video'
  ])('keeps %s indexable', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(false)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(false)
  })

  it('derives model redirect exclusions from canonical model metadata', () => {
    expect(
      isExcludedFromSitemap('https://comfy.org/p/supported-models/qwen-3-8b/')
    ).toBe(true)
    expect(
      isExcludedFromSitemap(
        'https://comfy.org/zh-CN/p/supported-models/grok-image/'
      )
    ).toBe(true)
  })
})
