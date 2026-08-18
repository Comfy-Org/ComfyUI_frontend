import { describe, expect, it } from 'vitest'

import { createUuidv4 } from '@/utils/uuid'

import { isUuidShapedSubgraphId, zSubgraphId } from './subgraphIdSchema'

const CANONICAL_UUID = '550e8400-e29b-41d4-a716-446655440000'

const INVALID_STRING_CASES: Array<[label: string, value: string]> = [
  ['empty string', ''],
  ['arbitrary path', '/some/path'],
  ['plain word', 'subgraph'],
  ['hash leftover', '#abc'],
  ['hex but not UUID-shaped', 'abcdef0123456789'],
  ['UUID with leading hash', `#${CANONICAL_UUID}`],
  ['UUID with whitespace', ` ${CANONICAL_UUID} `]
]

const NON_STRING_CASES: Array<[label: string, value: unknown]> = [
  ['number', 123],
  ['undefined', undefined],
  ['null', null],
  ['object', { id: 'abc' }]
]

describe('subgraphIdSchema', () => {
  describe('zSubgraphId', () => {
    it('accepts a freshly generated UUID v4', () => {
      expect(zSubgraphId.safeParse(createUuidv4()).success).toBe(true)
    })

    it('accepts a canonical UUID string', () => {
      expect(zSubgraphId.safeParse(CANONICAL_UUID).success).toBe(true)
    })

    it.for(INVALID_STRING_CASES)('rejects %s', ([_label, value]) => {
      expect(zSubgraphId.safeParse(value).success).toBe(false)
    })

    it.for(NON_STRING_CASES)('rejects non-string %s', ([_label, value]) => {
      expect(zSubgraphId.safeParse(value).success).toBe(false)
    })
  })

  describe('isUuidShapedSubgraphId', () => {
    it('returns true for a valid UUID', () => {
      expect(isUuidShapedSubgraphId(createUuidv4())).toBe(true)
    })

    it('returns false for an invalid value', () => {
      expect(isUuidShapedSubgraphId('not-a-uuid')).toBe(false)
      expect(isUuidShapedSubgraphId(undefined)).toBe(false)
      expect(isUuidShapedSubgraphId(42)).toBe(false)
    })
  })
})
