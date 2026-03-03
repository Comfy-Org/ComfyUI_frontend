import { describe, expect, it } from 'vitest'

import {
  commonType,
  isColorable,
  isNodeBindable,
  toClass
} from '@/lib/litegraph/src/utils/type'

describe('toClass', () => {
  class Point {
    x: number
    y: number
    constructor(source: { x: number; y: number }) {
      this.x = source.x
      this.y = source.y
    }
  }

  it('returns the existing instance unchanged when already the right class', () => {
    const instance = new Point({ x: 1, y: 2 })
    expect(toClass(Point, instance)).toBe(instance)
  })

  it('creates a new instance from a plain object', () => {
    const plain = { x: 3, y: 4 }
    const result = toClass(Point, plain)
    expect(result).toBeInstanceOf(Point)
    expect(result.x).toBe(3)
    expect(result.y).toBe(4)
  })
})

describe('isColorable', () => {
  it('returns true for an object with both setColorOption and getColorOption', () => {
    const obj = {
      setColorOption: () => {},
      getColorOption: () => null
    }
    expect(isColorable(obj)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isColorable(null)).toBe(false)
  })

  it('returns false when setColorOption is missing', () => {
    const obj = { getColorOption: () => null }
    expect(isColorable(obj)).toBe(false)
  })

  it('returns false when getColorOption is missing', () => {
    const obj = { setColorOption: () => {} }
    expect(isColorable(obj)).toBe(false)
  })
})

describe('isNodeBindable', () => {
  it('returns true for an object with a setNodeId function', () => {
    const widget = { setNodeId: (_id: number) => {} }
    expect(isNodeBindable(widget)).toBe(true)
  })

  it('returns false when setNodeId is not a function', () => {
    const widget = { setNodeId: 42 }
    expect(isNodeBindable(widget)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isNodeBindable(null)).toBe(false)
  })
})

describe('commonType', () => {
  it('returns the type when both arguments are identical', () => {
    expect(commonType('IMAGE', 'IMAGE')).toBe('IMAGE')
  })

  it('returns undefined when two different types have no overlap', () => {
    expect(commonType('IMAGE', 'LATENT')).toBeUndefined()
  })

  it('returns the concrete type when one argument is a wildcard', () => {
    expect(commonType('*', 'IMAGE')).toBe('IMAGE')
    expect(commonType('IMAGE', '*')).toBe('IMAGE')
  })

  it('returns wildcard when all arguments are wildcards', () => {
    expect(commonType('*', '*')).toBe('*')
  })

  it('returns the intersection of comma-delimited type lists', () => {
    expect(commonType('IMAGE,LATENT', 'LATENT,MASK')).toBe('LATENT')
  })

  it('returns multiple shared types joined by comma', () => {
    expect(commonType('IMAGE,LATENT,MASK', 'IMAGE,LATENT')).toBe('IMAGE,LATENT')
  })

  it('returns undefined when comma-delimited lists have no overlap', () => {
    expect(commonType('IMAGE,MASK', 'LATENT,CONDITIONING')).toBeUndefined()
  })

  it('returns undefined for non-string input', () => {
    expect(commonType(42 as unknown as string)).toBeUndefined()
  })

  it('ignores wildcards and uses only the non-wildcard types in intersection', () => {
    expect(commonType('*', 'IMAGE,LATENT', 'LATENT')).toBe('LATENT')
  })
})
