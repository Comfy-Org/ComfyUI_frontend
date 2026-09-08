import { describe, expect, it } from 'vitest'
import { filterKnownTags, TAG_REGISTRY, unknownTagWarningLines } from './tags'

describe('tag registry', () => {
  it('uses Playwright tag syntax for every entry', () => {
    expect(TAG_REGISTRY.every(({ tag }) => tag.startsWith('@'))).toBe(true)
  })
})

describe('filterKnownTags', () => {
  it('separates unknown tags while retaining known tags', () => {
    expect(filterKnownTags(['@canvas', '@made-up', '@widget'])).toEqual({
      kept: ['@canvas', '@widget'],
      unknown: ['@made-up']
    })
  })

  it('lists known tags with hints when reporting an unknown tag', () => {
    const warning = unknownTagWarningLines(['@made-up']).join('\n')

    expect(warning).toContain('Unknown tag(s) dropped: @made-up')
    expect(warning).toContain('@canvas (moving around the graph area)')
  })
})
