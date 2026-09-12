import { describe, expect, it } from 'vitest'

import { normalizeEmail } from './normalizeEmail'

describe('normalizeEmail', () => {
  it('returns null for null', () => {
    expect(normalizeEmail(null)).toBe(null)
  })

  it('returns null for undefined', () => {
    expect(normalizeEmail(undefined)).toBe(null)
  })

  it('returns null for blank or whitespace-only input', () => {
    expect(normalizeEmail('')).toBe(null)
    expect(normalizeEmail('   ')).toBe(null)
  })

  it('lowercases a mixed-case email', () => {
    expect(normalizeEmail('Alice@Example.COM')).toBe('alice@example.com')
  })

  it('returns an already-normalized email unchanged', () => {
    expect(normalizeEmail('alice@example.com')).toBe('alice@example.com')
  })

  it('trims leading and trailing spaces', () => {
    expect(normalizeEmail('  alice@example.com  ')).toBe('alice@example.com')
  })
})
