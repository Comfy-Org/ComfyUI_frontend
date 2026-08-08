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
  })
})

describe('getRoutes seedance', () => {
  it('serves the seedance page at its canonical path for en', () => {
    expect(getRoutes('en').seedance).toBe('/seedance-2.5')
  })

  it('serves a localized seedance path for zh-CN', () => {
    expect(getRoutes('zh-CN').seedance).toBe('/zh-CN/seedance-2.5')
  })
})

describe('getRoutes minimax', () => {
  it('serves the minimax page at its canonical path for en', () => {
    expect(getRoutes('en').minimax).toBe('/minimax')
  })

  it('serves a localized minimax path for zh-CN', () => {
    expect(getRoutes('zh-CN').minimax).toBe('/zh-CN/minimax')
  })
})

describe('getRoutes flux3', () => {
  it('serves the flux 3 page at its canonical path for en', () => {
    expect(getRoutes('en').flux3).toBe('/flux-3')
  })

  it('serves a localized flux 3 path for zh-CN', () => {
    expect(getRoutes('zh-CN').flux3).toBe('/zh-CN/flux-3')
  })
})
