import { describe, expect, it } from 'vitest'

import {
  alternatesFor,
  mirroredRoutes,
  ogLocale,
  ogLocaleAlternate,
  unprefixed,
  ZH_HREFLANG
} from './hreflang'

const SITE = 'https://comfy.org'

const FILES = [
  '/src/pages/index.astro',
  '/src/pages/about.astro',
  '/src/pages/cloud/pricing.astro',
  '/src/pages/affiliates/index.astro', // English only
  '/src/pages/404.astro',
  '/src/pages/p/supported-models/[slug].astro', // dynamic, English only
  '/src/pages/customers/[slug].astro', // dynamic, both trees
  '/src/pages/zh-CN/index.astro',
  '/src/pages/zh-CN/about.astro',
  '/src/pages/zh-CN/cloud/pricing.astro',
  '/src/pages/zh-CN/404.astro',
  '/src/pages/zh-CN/customers/[slug].astro'
]

describe('mirroredRoutes', () => {
  it('keeps only routes that exist in both locales', () => {
    expect([...mirroredRoutes(FILES)].sort()).toEqual([
      '/',
      '/about/',
      '/cloud/pricing/'
    ])
  })

  it('excludes an English-only page, so it is never advertised', () => {
    expect(mirroredRoutes(FILES).has('/affiliates/')).toBe(false)
  })

  it('excludes 404 even when both trees have one', () => {
    expect(mirroredRoutes(FILES).has('/404/')).toBe(false)
  })

  it('excludes dynamic routes, whose slug sets the file tree cannot see', () => {
    // customers/[slug].astro exists in both, but each getStaticPaths reads its
    // own locale's content, so parity is not implied by the file existing.
    expect(mirroredRoutes(FILES).has('/customers/[slug]/')).toBe(false)
    expect([...mirroredRoutes(FILES)].some((r) => r.includes('['))).toBe(false)
  })
})

describe('unprefixed', () => {
  it('strips the locale prefix and normalises the trailing slash', () => {
    expect(unprefixed('/zh-CN/cloud/pricing/')).toBe('/cloud/pricing/')
    expect(unprefixed('/cloud/pricing')).toBe('/cloud/pricing/')
    expect(unprefixed('/zh-CN')).toBe('/')
    expect(unprefixed('/')).toBe('/')
  })
})

describe('alternatesFor', () => {
  const mirrored = mirroredRoutes(FILES)

  it('emits a reciprocal pair plus x-default on a mirrored page', () => {
    expect(alternatesFor('/cloud/pricing/', SITE, { mirrored })).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/cloud/pricing/' },
      { hreflang: ZH_HREFLANG, href: 'https://comfy.org/zh-CN/cloud/pricing/' },
      { hreflang: 'x-default', href: 'https://comfy.org/cloud/pricing/' }
    ])
  })

  it('gives the Chinese page the identical set, so the cluster is reciprocal', () => {
    expect(alternatesFor('/zh-CN/cloud/pricing/', SITE, { mirrored })).toEqual(
      alternatesFor('/cloud/pricing/', SITE, { mirrored })
    )
  })

  it('handles the homepage without doubling the slash', () => {
    expect(alternatesFor('/', SITE, { mirrored }).map((a) => a.href)).toEqual([
      'https://comfy.org/',
      'https://comfy.org/zh-CN/',
      'https://comfy.org/'
    ])
  })

  it('emits nothing for a page with no twin', () => {
    // The whole point: /affiliates/ and every /p/supported-models/ page are
    // English only, and a cluster that links a 404 is worse than no cluster.
    expect(alternatesFor('/affiliates/', SITE, { mirrored })).toEqual([])
    expect(
      alternatesFor('/p/supported-models/wan/', SITE, { mirrored })
    ).toEqual([])
  })

  it('lets a dynamic route answer for itself', () => {
    // Only the page knows whether its slug built in the other locale.
    expect(
      alternatesFor('/customers/ubisoft/', SITE, { mirrored, hasTwin: true })
    ).toHaveLength(3)
    expect(
      alternatesFor('/customers/ubisoft/', SITE, { mirrored, hasTwin: false })
    ).toEqual([])
  })
})

describe('Open Graph locale', () => {
  it('uses the underscored OG form, not the BCP 47 tag', () => {
    expect(ogLocale('en')).toBe('en_US')
    expect(ogLocale('zh-CN')).toBe('zh_CN')
  })

  it('names the other language only when the page has one', () => {
    const withTwin = [{ hreflang: 'en', href: 'x' }]
    expect(ogLocaleAlternate('en', withTwin)).toBe('zh_CN')
    expect(ogLocaleAlternate('zh-CN', withTwin)).toBe('en_US')
    expect(ogLocaleAlternate('en', [])).toBeNull()
  })
})
