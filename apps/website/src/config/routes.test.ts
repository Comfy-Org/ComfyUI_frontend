import { describe, expect, it } from 'vitest'

import { getRoutes, localizeHref } from './routes'

describe('localizeHref', () => {
  it.for([
    { href: '/models', localized: '/zh-CN/models' },
    { href: '/models/', localized: '/zh-CN/models/' },
    { href: '/models?source=nav', localized: '/zh-CN/models?source=nav' },
    { href: '/models/example/', localized: '/models/example/' }
  ])('localizes $href for publication', ({ href, localized }) => {
    expect(localizeHref(href, 'zh-CN', 'publication')).toBe(localized)
  })

  it.for([
    {
      href: '/cloud#pricing',
      locale: 'zh-CN',
      expected: '/zh-CN/cloud#pricing'
    },
    {
      href: '/cloud?ref=nav',
      locale: 'zh-CN',
      expected: '/zh-CN/cloud?ref=nav'
    },
    { href: '/#features', locale: 'ja', expected: '/ja/#features' },
    { href: '/about#team', locale: 'ja', expected: '/about#team' },
    {
      href: '/p/supported-models/grok-imagine',
      locale: 'zh-CN',
      expected: '/p/supported-models/grok-imagine'
    },
    {
      href: '/terms-of-service#scope',
      locale: 'zh-CN',
      expected: '/terms-of-service#scope'
    }
  ] as const)(
    'maps $href in $locale to $expected',
    ({ href, locale, expected }) => {
      expect(localizeHref(href, locale)).toBe(expected)
    }
  )

  it('prefixes an internal path for a non-default locale', () => {
    expect(localizeHref('/mcp', 'zh-CN')).toBe('/zh-CN/mcp')
  })

  it('leaves the default locale unprefixed', () => {
    expect(localizeHref('/mcp', 'en')).toBe('/mcp')
    expect(localizeHref('/models/seedance-2/', 'zh-CN')).toBe(
      '/models/seedance-2/'
    )
    expect(localizeHref('/models/sign-in?return=%2Fmodels', 'ja')).toBe(
      '/models/sign-in?return=%2Fmodels'
    )
  })

  it('passes external URLs through unchanged', () => {
    expect(
      localizeHref('https://docs.comfy.org/agent-tools/cloud', 'zh-CN')
    ).toBe('https://docs.comfy.org/agent-tools/cloud')
  })

  it('never prefixes locale-invariant routes', () => {
    expect(localizeHref('/terms-of-service', 'zh-CN')).toBe('/terms-of-service')
    expect(localizeHref('/enterprise-msa', 'zh-CN')).toBe('/enterprise-msa')
  })

  it.for(['/enterprise', '/enterprise/managed-builds'])(
    'localizes the Chinese sales page %s while keeping Japanese on English',
    (path) => {
      expect(localizeHref(path, 'zh-CN')).toBe(`/zh-CN${path}`)
      expect(localizeHref(path, 'ja')).toBe(path)
    }
  )

  it('only localizes the Japanese homepage', () => {
    expect(localizeHref('/', 'ja')).toBe('/ja/')
    expect(localizeHref('/cloud', 'ja')).toBe('/cloud')
  })
})

describe('getRoutes workshop', () => {
  it('keeps the workshop routes locale-invariant', () => {
    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      expect(getRoutes(locale).workshop).toBe('/models')
      expect(getRoutes(locale).workshopSignIn).toBe('/login/')
    }
  })

  it('still localizes the rest of the Japanese routes', () => {
    expect(getRoutes('ja').home).toBe('/ja/')
    expect(getRoutes('ja').cloud).toBe('/cloud')
  })
})

describe('getRoutes models', () => {
  it('serves the models catalog at its canonical path for zh-CN', () => {
    expect(getRoutes('zh-CN').models).toBe('/p/supported-models')
  })
})

describe('getRoutes minimaxLicenseProfessionalRequest', () => {
  it('serves the license request page at its canonical path for en', () => {
    expect(getRoutes('en').minimaxLicenseProfessionalRequest).toBe(
      '/minimax/license/professional-request'
    )
  })

  it('never prefixes the English-only license request page for zh-CN', () => {
    expect(getRoutes('zh-CN').minimaxLicenseProfessionalRequest).toBe(
      '/minimax/license/professional-request'
    )
  })
})
