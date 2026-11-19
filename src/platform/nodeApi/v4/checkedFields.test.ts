import { describe, expect, it, vi } from 'vitest'

import { isInvalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { optionalCallback, checkedFields } from './checkedFields'

const FIELDS = { title: true, size: true } as const

describe('reading the fields of an object a pack passed', () => {
  it('copies its own fields, reading each once', () => {
    const read = vi.fn(() => 'Title')
    const given = Object.defineProperty({ size: 2 }, 'title', {
      get: read,
      enumerable: true
    })

    expect(checkedFields('m', 'a patch', given, FIELDS)).toEqual({
      title: 'Title',
      size: 2
    })
    expect(read).toHaveBeenCalledOnce()
  })

  it.for([
    [
      'a field it does not know',
      { title: 'x', titel: 'y' },
      "a patch of title, size only, not 'titel'."
    ],
    [
      '__proto__ as a field',
      JSON.parse('{"__proto__": {}}'),
      "a patch of title, size only, not '__proto__'."
    ],
    ['an object of a class', new Date(0), 'a patch as a plain object'],
    ['a list', ['title'], 'a patch as a plain object'],
    ['null', null, 'a patch as a plain object, not null.'],
    [
      'an object whose prototype is not Object',
      Object.create(Object.create(null)),
      'a patch as a plain object'
    ]
  ] as const)('refuses %s', ([, given, message]) => {
    let thrown: unknown
    try {
      checkedFields('m', 'a patch', given, FIELDS)
    } catch (error) {
      thrown = error
    }

    expect(isInvalidArgument(thrown)).toBe(true)
    expect(String(thrown)).toContain(`m needs ${message}`)
  })

  it('reads no inherited and no hidden field', () => {
    const given = Object.defineProperty(Object.create(null), 'title', {
      value: 'hidden',
      enumerable: false
    })

    expect(checkedFields('m', 'a patch', given, FIELDS)).toEqual({})
  })

  it('reads a field it is told to ignore as absent', () => {
    expect(
      checkedFields('m', 'a catalog', { title: 'x', phrases: {} }, FIELDS, [
        'phrases'
      ])
    ).toEqual({ title: 'x' })
  })
})

describe('reading a callback a pack passed', () => {
  it('gives the function, undefined for none, and refuses anything else', () => {
    const run = () => {}

    expect(optionalCallback('m', 'run', run)).toBe(run)
    expect(optionalCallback('m', 'run', undefined)).toBeUndefined()
    expect(() => optionalCallback('m', 'run', 'go')).toThrow(
      "m needs run as a function, not 'go'."
    )
  })
})
