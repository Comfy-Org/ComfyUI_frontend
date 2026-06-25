import { describe, expect, it } from 'vitest'

import { toNodeId, parseNodeId } from '@/types/nodeId'

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
