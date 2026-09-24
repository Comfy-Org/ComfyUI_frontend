import { describe, expect, it } from 'vitest'

import { hubKeys, tHub } from './hub'
import { translationKeys } from './translations'

describe('the Hub table', () => {
  // Its own copy is looked up before the shared table, so a key in both would
  // quietly shadow the site's.
  it('claims no key the shared table already has', () => {
    const shared = new Set<string>(translationKeys)

    expect(hubKeys.filter((key) => shared.has(key))).toEqual([])
  })

  it('reads a key of its own', () => {
    expect(tHub('workshop.v2.meta.title', 'en')).toBe('Hub - Comfy')
  })

  // The Hub's components say plenty the rest of the site also says, and those
  // words stay in the one table everybody shares.
  it('falls through to the shared table for everything else', () => {
    expect(tHub('workshop.hero.eyebrow', 'en')).toBe('Models')
  })

  it('falls back to English when a locale has no copy of its own', () => {
    expect(tHub('workshop.v2.meta.title', 'ja')).toBe('Hub - Comfy')
  })
})
