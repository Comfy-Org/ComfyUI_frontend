import { describe, expect, it } from 'vitest'

import {
  isValidEmail,
  normalizeEmail,
  sanitizeInviteEmails
} from './inviteEmails'

describe('isValidEmail', () => {
  it('accepts a well-formed address and rejects malformed ones', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('missing@domain')).toBe(false)
    expect(isValidEmail('two @spaces.com')).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })
})

describe('sanitizeInviteEmails', () => {
  it('dedupes case-insensitively after normalizing', () => {
    expect(
      sanitizeInviteEmails(['A@B.com', 'a@b.com ', 'c@d.com'], 50)
    ).toEqual(['a@b.com', 'c@d.com'])
  })

  it('drops blank entries', () => {
    expect(sanitizeInviteEmails(['a@b.com', '', '   '], 50)).toEqual([
      'a@b.com'
    ])
  })

  it('clamps to maxSeats, keeping the first entries', () => {
    expect(sanitizeInviteEmails(['a@b.com', 'c@d.com', 'e@f.com'], 2)).toEqual([
      'a@b.com',
      'c@d.com'
    ])
  })
})
