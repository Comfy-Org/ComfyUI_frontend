import { describe, expect, it } from 'vitest'

import { resolvePrioritizedIds } from './resolvePrioritizedIds'

const valid = new Set(['a', 'b', 'c', 'd'])

describe('resolvePrioritizedIds', () => {
  it('honors payload order and caps at n', () => {
    expect(
      resolvePrioritizedIds(['c', 'a'], ['a', 'b', 'd'], valid, 3)
    ).toEqual(['c', 'a', 'b'])
  })

  it('drops ids that are not in the valid set', () => {
    expect(resolvePrioritizedIds(['ghost', 'b'], ['a'], valid, 5)).toEqual([
      'b',
      'a'
    ])
  })

  it('backfills from defaults up to n', () => {
    expect(resolvePrioritizedIds([], ['a', 'b', 'c'], valid, 2)).toEqual([
      'a',
      'b'
    ])
  })

  it('deduplicates across payload and defaults', () => {
    expect(resolvePrioritizedIds(['a', 'a'], ['a', 'b'], valid, 5)).toEqual([
      'a',
      'b'
    ])
  })

  it('never yields an empty list when defaults are valid', () => {
    expect(resolvePrioritizedIds(['ghost'], ['a', 'b'], valid, 2)).toEqual([
      'a',
      'b'
    ])
  })

  it('yields an empty list when nothing valid remains', () => {
    expect(resolvePrioritizedIds(['ghost'], ['also-ghost'], valid, 5)).toEqual(
      []
    )
    expect(resolvePrioritizedIds(['a'], ['b'], valid, 0)).toEqual([])
  })
})
