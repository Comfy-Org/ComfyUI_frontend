import { describe, expect, it } from 'vitest'

import { frozenSavable, isSavable, savableValue } from './savableValue'

describe('a value the workflow saves unchanged', () => {
  it('copies it in one pass, unfrozen', () => {
    const value = { list: [1, 'two', null, { deep: true }] }
    const copy = savableValue('m', value)

    expect(copy).toEqual(value)
    expect(copy).not.toBe(value)
    expect(Object.isFrozen(copy)).toBe(false)
  })

  it('keeps __proto__ as a field and not as the prototype', () => {
    const copy = savableValue('m', JSON.parse('{"__proto__": {"x": 1}}'))

    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype)
    expect(Object.keys(copy as object)).toEqual(['__proto__'])
  })

  it.for([
    ['a nested function', { run: () => 1 }, 'value.run'],
    ['a nested NaN', { n: Number.NaN }, 'value.n'],
    ['a nested undefined', { gone: undefined }, 'value.gone'],
    ['a Date', [new Date(0)], 'value[0]'],
    ['a toJSON', { toJSON: () => 5 }, 'value.toJSON'],
    [
      'a getter',
      Object.defineProperty({}, 'g', { get: () => 1, enumerable: true }),
      'value.g'
    ],
    ['a BigInt', 1n, 'value']
  ] as const)('refuses %s and names where it is', ([, value, path]) => {
    expect(() => savableValue('m', value)).toThrow(
      `m needs ${path} as a string`
    )
    expect(isSavable(value)).toBe(false)
  })

  it('refuses a value that holds itself, and takes one held twice', () => {
    const shared = { x: 1 }
    const looped: Record<string, unknown> = {}
    looped.self = looped

    expect(isSavable({ a: shared, b: shared })).toBe(true)
    expect(isSavable(looped)).toBe(false)
  })

  it('freezes a copy for a reader, keeping what it is told to keep', () => {
    const blob = new Blob(['x'])
    const copy = frozenSavable(
      { preview: blob, list: [1] },
      (value) => value instanceof Blob
    )

    expect(copy).toEqual({ preview: blob, list: [1] })
    expect(Object.isFrozen(copy)).toBe(true)
    expect(frozenSavable({ run: () => 1 })).toBeUndefined()
  })

  it('refuses a value nested deeper than a thousand levels, instead of overflowing the stack', () => {
    let deep: unknown = 1
    for (let depth = 0; depth < 5000; depth++) deep = [deep]

    expect(() => savableValue('setProperty', deep)).toThrow(
      'setProperty needs value nested at most 1000 deep, not a list.'
    )
    expect(isSavable(deep)).toBe(false)
    expect(frozenSavable(deep)).toBeUndefined()
  })
})
