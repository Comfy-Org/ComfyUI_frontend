import { describe, expect, it } from 'vitest'

import { externalLinks } from './routes'

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
