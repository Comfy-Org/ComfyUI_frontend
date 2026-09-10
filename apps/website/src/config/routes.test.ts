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

  it('never prefixes a page NESTED under a locale-invariant route', () => {
    // The two answers to "is this path locale-invariant?" disagreed:
    // `isLocaleInvariantPath` matched prefixes while this matched only whole
    // paths, so a per-model page under the catalogue slipped through and
    // /zh-CN/models linked to /zh-CN/p/supported-models/grok-imagine, which has
    // never existed. Every individual model page has this shape.
    expect(localizeHref('/p/supported-models', 'zh-CN')).toBe(
      '/p/supported-models'
    )
    expect(localizeHref('/p/supported-models/grok-imagine', 'zh-CN')).toBe(
      '/p/supported-models/grok-imagine'
    )
    expect(localizeHref('/pixal3d-trellis2/anything', 'ja')).toBe(
      '/pixal3d-trellis2/anything'
    )
  })

  /**
   * A query or fragment is not part of the route. Checking it as one sent a
   * link into a section of a published page back to the English tree.
   */
  it('keeps a query or fragment while localizing the path', () => {
    expect(localizeHref('/cloud#pricing', 'zh-CN')).toBe('/zh-CN/cloud#pricing')
    expect(localizeHref('/cloud?ref=nav', 'zh-CN')).toBe('/zh-CN/cloud?ref=nav')
    expect(localizeHref('/about#team', 'ja')).toBe('/about#team')
  })

  it('still refuses to localize a held-back route that carries one', () => {
    expect(localizeHref('/cli#install', 'ja')).toBe('/cli#install')
  })

  it('still refuses to localize an invariant route that carries one', () => {
    expect(localizeHref('/terms-of-service#scope', 'zh-CN')).toBe(
      '/terms-of-service#scope'
    )
  })

  /**
   * Japanese publishes tier 1 and holds the long tail back. A held-back route
   * is left unprefixed so nothing on the site links to a page that is not
   * published, which is the same predicate the hreflang emitter reads.
   *
   * This asserted "only the home page" until P4 filled Japanese and tier 1 went
   * live. The routes are named from both sides on purpose: a one-sided check
   * passes just as well when the allowlist is empty as when it is right.
   */
  it('localizes a published Japanese route and leaves a held-back one alone', () => {
    expect(localizeHref('/', 'ja')).toBe('/ja/')
    expect(localizeHref('/cloud', 'ja')).toBe('/cloud')
    expect(localizeHref('/about', 'ja')).toBe('/about')

    expect(localizeHref('/cli', 'ja')).toBe('/cli')
    expect(localizeHref('/careers', 'ja')).toBe('/careers')
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
