import { describe, expect, it } from 'vitest'

import { createUuidv4 } from '@/lib/litegraph/src/utils/uuid'

import { isValidSubgraphId, zSubgraphId } from './subgraphIdSchema'

describe('subgraphIdSchema', () => {
  describe('zSubgraphId', () => {
    it('accepts a freshly generated UUID v4', () => {
      const id = createUuidv4()
      expect(zSubgraphId.safeParse(id).success).toBe(true)
    })

    it('accepts a canonical UUID string', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000'
      expect(zSubgraphId.safeParse(id).success).toBe(true)
    })

    it.each([
      ['empty string', ''],
      ['arbitrary path', '/some/path'],
      ['plain word', 'subgraph'],
      ['hash leftover', '#abc'],
      ['hex but not UUID-shaped', 'abcdef0123456789'],
      ['UUID with leading hash', '#550e8400-e29b-41d4-a716-446655440000'],
      ['UUID with whitespace', ' 550e8400-e29b-41d4-a716-446655440000 ']
    ])('rejects %s', (_label, value) => {
      expect(zSubgraphId.safeParse(value).success).toBe(false)
    })

    it.each([
      ['number', 123],
      ['undefined', undefined],
      ['null', null],
      ['object', { id: 'abc' }]
    ])('rejects non-string %s', (_label, value) => {
      expect(zSubgraphId.safeParse(value).success).toBe(false)
    })
  })

  describe('isValidSubgraphId', () => {
    it('returns true for a valid UUID', () => {
      expect(isValidSubgraphId(createUuidv4())).toBe(true)
    })

    it('returns false for an invalid value', () => {
      expect(isValidSubgraphId('not-a-uuid')).toBe(false)
      expect(isValidSubgraphId(undefined)).toBe(false)
      expect(isValidSubgraphId(42)).toBe(false)
    })
  })
})
