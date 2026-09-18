import { describe, expect, it } from 'vitest'

import {
  pointerKeys,
  setAtPointer,
  valuesAtPointer
} from './workshop-json-pointer'

describe('pointerKeys', () => {
  it('parses empty and escaped pointers', () => {
    expect(pointerKeys('')).toEqual([])
    expect(pointerKeys('/a~01b/~1')).toEqual(['a~1b', '/'])
  })

  it.for(['missing-slash', '/dangling~', '/bad~2escape'])(
    'rejects invalid pointer %s',
    (path) => expect(() => pointerKeys(path)).toThrow('Invalid JSON pointer')
  )

  it('rejects excessive depth and prototype keys', () => {
    expect(
      pointerKeys(`/${Array.from({ length: 64 }, () => 'x').join('/')}`)
    ).toHaveLength(64)
    expect(() =>
      pointerKeys(`/${Array.from({ length: 65 }, () => 'x').join('/')}`)
    ).toThrow('Unsafe JSON pointer')
    for (const key of ['__proto__', 'prototype', 'constructor'])
      expect(() => pointerKeys(`/${key}`)).toThrow('Unsafe JSON pointer')
  })
})

describe('valuesAtPointer', () => {
  it('traverses wildcards over arrays and objects', () => {
    expect(
      valuesAtPointer({ rows: [{ id: 1 }, { id: 2 }] }, '/rows/*/id')
    ).toEqual([1, 2])
    expect(
      valuesAtPointer({ rows: { a: { id: 1 }, b: { id: 2 } } }, '/rows/*/id')
    ).toEqual([1, 2])
  })

  it('returns no values for missing keys or primitive intermediates', () => {
    expect(valuesAtPointer({ row: {} }, '/row/missing')).toEqual([])
    expect(valuesAtPointer({ row: 1 }, '/row/id')).toEqual([])
  })
})

describe('setAtPointer', () => {
  it('appends at an array boundary and rejects sparse or named array keys', () => {
    const root: Record<string, unknown> = { rows: ['first'] }
    setAtPointer(root, '/rows/1', 'second')
    expect(root).toEqual({ rows: ['first', 'second'] })
    expect(() => setAtPointer(root, '/rows/3', 'fourth')).toThrow(
      'Sparse media array'
    )
    expect(() => setAtPointer(root, '/rows/name', 'value')).toThrow(
      'Sparse media array'
    )
  })

  it('overwrites empty slots but rejects conflicting values', () => {
    const root: Record<string, unknown> = {
      empty: '',
      missing: undefined,
      full: 'old'
    }
    setAtPointer(root, '/empty', 'new')
    setAtPointer(root, '/missing', 'new')
    expect(root).toMatchObject({ empty: 'new', missing: 'new' })
    expect(() => setAtPointer(root, '/full', 'new')).toThrow(
      'Conflicting media input'
    )
  })

  it('creates array or object containers from the next key', () => {
    const root: Record<string, unknown> = {}
    setAtPointer(root, '/array/0/value', 'a')
    setAtPointer(root, '/object/key/value', 'b')
    expect(root).toEqual({
      array: [{ value: 'a' }],
      object: { key: { value: 'b' } }
    })
  })
})
