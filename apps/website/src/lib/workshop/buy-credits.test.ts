import { describe, expect, it } from 'vitest'

import { platformCreditsHref } from './buy-credits'

describe('platformCreditsHref', () => {
  it('sends the page as the return address', () => {
    const url = new URL(platformCreditsHref('/workshop/models/vidu-q2/'))

    expect(url.origin).toBe('https://platform.comfy.org')
    expect(url.searchParams.get('returnTo')).toBe('/workshop/models/vidu-q2/')
    expect(url.searchParams.get('utm_source')).toBe('workshop')
  })

  it('refuses a return address that leaves the site', () => {
    const url = new URL(platformCreditsHref('//evil.example/steal'))

    expect(url.searchParams.get('returnTo')).toBeNull()
  })
})
