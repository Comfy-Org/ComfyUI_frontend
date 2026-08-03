import { describe, expect, it } from 'vitest'

import { parseNodeId, serializeNodeId, toNodeId } from '@/types/nodeId'

describe('nodeId', () => {
  it('normalizes serialized node ids to strings', () => {
    expect(toNodeId(42)).toBe('42')
    expect(toNodeId('node-42')).toBe('node-42')
  })
})

describe('parseNodeId', () => {
  it('parses serialized node ids', () => {
    expect(parseNodeId(42)).toBe('42')
    expect(parseNodeId(-10)).toBe('-10')
    expect(parseNodeId('node-42')).toBe('node-42')
  })

  it('rejects values outside the serialized node id boundary shape', () => {
    expect(parseNodeId('')).toBeNull()
    expect(parseNodeId(1.5)).toBeNull()
    expect(parseNodeId(Number.NaN)).toBeNull()
    expect(parseNodeId(null)).toBeNull()
    expect(parseNodeId(undefined)).toBeNull()
  })
})

describe('serializeNodeId', () => {
  it('serializes canonical integer strings as numbers', () => {
    expect(serializeNodeId('42')).toBe(42)
    expect(serializeNodeId('-10')).toBe(-10)
  })

  it('preserves non-canonical numeric strings and named ids', () => {
    expect(serializeNodeId('1e10')).toBe('1e10')
    expect(serializeNodeId('001')).toBe('001')
    expect(serializeNodeId('NaN')).toBe('NaN')
    expect(serializeNodeId('Infinity')).toBe('Infinity')
    expect(serializeNodeId('node-42')).toBe('node-42')
  })

  it('preserves numeric values', () => {
    expect(serializeNodeId(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER
    )
  })
})
