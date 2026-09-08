import { describe, expect, it } from 'vitest'

import { getRoutes, localizeHref } from './routes'

describe('localizeHref', () => {
  it('prefixes an internal path for a non-default locale', () => {
    expect(localizeHref('/mcp', 'zh-CN')).toBe('/zh-CN/mcp')
  })

  it('leaves the default locale unprefixed', () => {
    expect(localizeHref('/mcp', 'en')).toBe('/mcp')
  })

  it('passes external URLs through unchanged', () => {
    expect(
      localizeHref('https://docs.comfy.org/agent-tools/cloud', 'zh-CN')
    ).toBe('https://docs.comfy.org/agent-tools/cloud')
  })

  it('never prefixes locale-invariant routes', () => {
    expect(localizeHref('/terms-of-service', 'zh-CN')).toBe('/terms-of-service')
    expect(localizeHref('/enterprise', 'zh-CN')).toBe('/enterprise')
    expect(localizeHref('/enterprise/managed-builds', 'zh-CN')).toBe(
      '/enterprise/managed-builds'
    )
  })

  it('only localizes the Japanese homepage', () => {
    expect(localizeHref('/', 'ja')).toBe('/ja/')
    expect(localizeHref('/cloud', 'ja')).toBe('/cloud')
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
