import { describe, expect, it } from 'vitest'

import { externalLinks, localizeHref } from './routes'

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

describe('externalLinks.cloudCta', () => {
  it('carries the full attribution contract', () => {
    const url = new URL(externalLinks.cloudCta('hero_run_first_workflow'))
    expect(url.origin).toBe('https://cloud.comfy.org')
    expect(url.searchParams.get('utm_source')).toBe('comfy_org')
    expect(url.searchParams.get('utm_medium')).toBe('website')
    expect(url.searchParams.get('utm_campaign')).toBe('free_tier')
    expect(url.searchParams.get('utm_content')).toBe('hero_run_first_workflow')
  })

  it('encodes content that would break the query string', () => {
    const url = new URL(externalLinks.cloudCta('a&b #c'))
    expect(url.searchParams.get('utm_content')).toBe('a&b #c')
  })
})
