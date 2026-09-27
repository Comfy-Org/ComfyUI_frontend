import { describe, expect, it } from 'vitest'

import { resolveRel } from './cta'

describe('resolveRel', () => {
  it('prefers an explicit rel over the target-derived default', () => {
    expect(resolveRel({ rel: 'nofollow', target: '_blank' })).toBe('nofollow')
  })

  it('adds noopener noreferrer for _blank targets', () => {
    expect(resolveRel({ target: '_blank' })).toBe('noopener noreferrer')
  })

  it('returns undefined for non-blank targets', () => {
    expect(resolveRel({ target: '_self' })).toBeUndefined()
    expect(resolveRel({})).toBeUndefined()
  })
})
