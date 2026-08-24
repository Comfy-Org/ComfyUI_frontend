import { describe, expect, it } from 'vitest'

import { fnv1a, fnv1aHex } from './hashUtil'

describe('fnv1a', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = fnv1a('workflows/test.json')
    const hash2 = fnv1a('workflows/test.json')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different inputs', () => {
    const hash1 = fnv1a('workflows/a.json')
    const hash2 = fnv1a('workflows/b.json')
    expect(hash1).not.toBe(hash2)
  })

  it('returns unsigned 32-bit integer', () => {
    const hash = fnv1a('test')
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThanOrEqual(0xffffffff)
  })

  it('handles empty string', () => {
    const hash = fnv1a('')
    expect(hash).toBe(2166136261)
  })

  it('handles unicode characters', () => {
    const hash = fnv1a('workflows/工作流程.json')
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThanOrEqual(0xffffffff)
  })

  it('handles special characters', () => {
    const hash = fnv1a('workflows/My Workflow (Copy 2).json')
    expect(hash).toBeGreaterThanOrEqual(0)
  })
})

describe('fnv1aHex', () => {
  it('returns 8-character hex string', () => {
    expect(fnv1aHex('workflows/test.json')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('pads hashes below 0x10000000 with leading zeros', () => {
    expect(fnv1a('pad-300')).toBeLessThan(0x10000000)
    expect(fnv1aHex('pad-300')).toBe('022c1972')
  })

  it('produces different digests for similar inputs', () => {
    expect(fnv1aHex('workflows/Untitled.json')).not.toBe(
      fnv1aHex('workflows/Untitled (2).json')
    )
  })
})
