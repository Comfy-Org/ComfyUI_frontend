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

describe('getRoutes minimaxH3', () => {
  it('serves the MiniMax H3 page at its canonical path for en', () => {
    expect(getRoutes('en').minimaxH3).toBe('/minimax-h3')
  })

  it('serves a localized MiniMax H3 path for zh-CN', () => {
    expect(getRoutes('zh-CN').minimaxH3).toBe('/zh-CN/minimax-h3')
  })
})
