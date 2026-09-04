import { describe, expect, it } from 'vitest'

import {
  compareNodeIds,
  parseNodeId,
  serializeNodeId,
  toNodeId
} from '@/types/nodeId'

describe('nodeId', () => {
  it('normalizes serialized node ids to strings', () => {
    expect(toNodeId(42)).toBe('42')
    expect(toNodeId('node-42')).toBe('node-42')
  })

  it('provides a total order for numeric and named ids', () => {
    const ids = ['node-z', '10', '2', 'node-a', '01', '1'].map(toNodeId)

    expect(ids.sort(compareNodeIds)).toEqual(
      ['01', '1', '2', '10', 'node-a', 'node-z'].map(toNodeId)
    )
  })

  it('orders unsafe negative integers by their exact values', () => {
    const ids = [
      '-9007199254740993',
      '-9007199254740992',
      '-9007199254740994'
    ].map(toNodeId)

    expect(ids.sort(compareNodeIds)).toEqual(
      ['-9007199254740994', '-9007199254740993', '-9007199254740992'].map(
        toNodeId
      )
    )
  })

  it('orders empty and whitespace-only ids as non-numeric ids', () => {
    const ids = [' ', '', '0', '-1'].map(toNodeId)

    expect(ids.sort(compareNodeIds)).toEqual(['-1', '0', '', ' '].map(toNodeId))
  })

  it('provides a transitive order across integer and named ID syntax', () => {
    const first = toNodeId('9007199254740992')
    const second = toNodeId('09007199254740993')
    const third = toNodeId('9.007199254740992e15')

    expect(compareNodeIds(first, second)).toBeLessThan(0)
    expect(compareNodeIds(second, third)).toBeLessThan(0)
    expect(compareNodeIds(first, third)).toBeLessThan(0)
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
