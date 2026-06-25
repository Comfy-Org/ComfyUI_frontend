import { describe, expect, it } from 'vitest'

import { isNodeId, toNodeId, parseNodeId } from '@/types/nodeId'

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

describe('isNodeId', () => {
  it('accepts non-empty strings', () => {
    expect(isNodeId('42')).toBe(true)
    expect(isNodeId('node-42')).toBe(true)
  })

  it('rejects unparsed serialized ids and empty strings', () => {
    expect(isNodeId(42)).toBe(false)
    expect(isNodeId('')).toBe(false)
    expect(isNodeId(null)).toBe(false)
  })
})
