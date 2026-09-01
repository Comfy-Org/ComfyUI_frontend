import { describe, expect, it } from 'vitest'

import { hreflangAlternates, sitemapAlternates } from './hreflang'

const ORIGIN = 'https://comfy.org'

describe('hreflangAlternates', () => {
  it('pairs an English page with its zh-CN twin and x-default', () => {
    expect(hreflangAlternates('/cli/', ORIGIN)).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/cli/' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/cli/' },
      { hreflang: 'x-default', href: 'https://comfy.org/cli/' }
    ])
  })

  it('emits the same set from the zh-CN side', () => {
    expect(hreflangAlternates('/zh-CN/cli/', ORIGIN)).toEqual(
      hreflangAlternates('/cli/', ORIGIN)
    )
  })

  it('handles the home page in both locales', () => {
    const home = hreflangAlternates('/', ORIGIN)
    expect(home.map((a) => a.href)).toEqual([
      'https://comfy.org/',
      'https://comfy.org/zh-CN/',
      'https://comfy.org/'
    ])
    expect(hreflangAlternates('/zh-CN/', ORIGIN)).toEqual(home)
    expect(hreflangAlternates('/zh-CN', ORIGIN)).toEqual(home)
  })

  it('covers dynamic routes that exist in both locales', () => {
    expect(
      hreflangAlternates('/customers/moment-factory/', ORIGIN).map(
        (a) => a.href
      )
    ).toContain('https://comfy.org/zh-CN/customers/moment-factory/')
  })

  it.for([
    '/affiliates/',
    '/affiliates/terms/',
    '/enterprise-msa/',
    '/terms-of-service/',
    '/zh-CN/terms-of-service/',
    '/p/supported-models/',
    '/p/supported-models/flux-1-dev/',
    '/404'
  ])('emits nothing for English-only route %s', (pathname) => {
    expect(hreflangAlternates(pathname, ORIGIN)).toEqual([])
  })
})

describe('sitemapAlternates', () => {
  it('maps alternates to sitemap link entries', () => {
    expect(sitemapAlternates('https://comfy.org/zh-CN/mcp/')).toEqual([
      { url: 'https://comfy.org/mcp/', lang: 'en' },
      { url: 'https://comfy.org/zh-CN/mcp/', lang: 'zh-CN' },
      { url: 'https://comfy.org/mcp/', lang: 'x-default' }
    ])
  })

  it('leaves English-only entries without links', () => {
    expect(sitemapAlternates('https://comfy.org/affiliates/')).toBeUndefined()
  })
})
