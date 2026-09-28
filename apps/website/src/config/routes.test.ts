import { describe, expect, it } from 'vitest'

import { apiKeysLink, externalLinks, getRoutes, localizeHref } from './routes'

describe('localizeHref', () => {
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
  })

  it('links to translated enterprise pages', () => {
    expect(localizeHref('/enterprise', 'zh-CN')).toBe('/zh-CN/enterprise')
    expect(localizeHref('/enterprise/managed-builds', 'zh-CN')).toBe(
      '/zh-CN/enterprise/managed-builds'
    )
  })

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

describe('apiKeysLink', () => {
  it.for([
    {
      from: { onboarding: 'router' } as const,
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=router'
    },
    {
      from: {
        onboarding: 'models',
        model: 'byteplus--seedream-5-pro--generate-images'
      } as const,
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=models&model=byteplus--seedream-5-pro--generate-images'
    },
    {
      from: { onboarding: 'models', model: undefined } as const,
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=models'
    },
    {
      from: { onboarding: 'comfy_api' } as const,
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=comfy_api'
    }
  ])('names the onboarding product and model: $href', ({ from, href }) => {
    expect(apiKeysLink(from)).toBe(href)
    expect(apiKeysLink(from).startsWith(externalLinks.apiKeys)).toBe(true)
  })
})
