import { describe, expect, it } from 'vitest'

import { isRecord } from '@e2e/fixtures/utils/isRecord'

describe('isRecord', () => {
  it('accepts objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ type: 'doc_ops' })).toBe(true)
    expect(isRecord([])).toBe(true)
  })

  it('rejects null and primitives', () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('doc_ops')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(true)).toBe(false)
  })
})
