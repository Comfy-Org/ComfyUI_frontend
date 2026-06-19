import { describe, expect, it } from 'vitest'

import { isNumericNodeId, nodeIdToNumber, tryAsNodeId } from '@/types/nodeId'

describe('isNumericNodeId', () => {
  it('treats non-negative counter ids as numeric in both forms', () => {
    expect(isNumericNodeId(0)).toBe(true)
    expect(isNumericNodeId(42)).toBe(true)
    expect(isNumericNodeId('0')).toBe(true)
    expect(isNumericNodeId('42')).toBe(true)
  })

  it('rejects negative sentinels consistently for number and string forms', () => {
    expect(isNumericNodeId(-1)).toBe(false)
    expect(isNumericNodeId('-1')).toBe(false)
    expect(isNumericNodeId(-10)).toBe(false)
    expect(isNumericNodeId('-10')).toBe(false)
  })

  it('rejects UUIDs, composite ids, and non-integers', () => {
    expect(isNumericNodeId('10:3')).toBe(false)
    expect(isNumericNodeId('3f1beb2b-bded')).toBe(false)
    expect(isNumericNodeId(1.5)).toBe(false)
    expect(isNumericNodeId('1.5')).toBe(false)
  })
})

describe('nodeIdToNumber', () => {
  it('converts numeric ids in both forms', () => {
    expect(nodeIdToNumber(42)).toBe(42)
    expect(nodeIdToNumber('42')).toBe(42)
  })

  it('throws instead of returning NaN for non-numeric ids', () => {
    expect(() => nodeIdToNumber('abc')).toThrow(TypeError)
    expect(() => nodeIdToNumber('10:3')).toThrow(TypeError)
    expect(() => nodeIdToNumber(Number.NaN)).toThrow(TypeError)
  })

  it('rejects non-decimal string formats like asNodeId does', () => {
    expect(() => nodeIdToNumber('0x10')).toThrow(TypeError)
    expect(() => nodeIdToNumber('1e3')).toThrow(TypeError)
  })
})

describe('tryAsNodeId', () => {
  it('brands valid decimal ids in both forms', () => {
    expect(tryAsNodeId(0)).toBe(0)
    expect(tryAsNodeId('42')).toBe(42)
    expect(tryAsNodeId(-1)).toBe(-1)
  })

  it('returns null instead of throwing for invalid or missing ids', () => {
    expect(tryAsNodeId(null)).toBeNull()
    expect(tryAsNodeId(undefined)).toBeNull()
    expect(tryAsNodeId('')).toBeNull()
    expect(tryAsNodeId('0x10')).toBeNull()
    expect(tryAsNodeId('10:3')).toBeNull()
    expect(tryAsNodeId('3f1beb2b-bded')).toBeNull()
  })
})
