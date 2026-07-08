import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  findFirstNode,
  findFreeSlotOfType,
  getAllNestedItems
} from './collections'

import type { Positionable } from '../interfaces'

describe('getAllNestedItems', () => {
  it('returns empty for an undefined input set', () => {
    expect(getAllNestedItems(undefined)).toEqual(new Set())
  })

  it('flattens nested children while skipping pinned and repeated items', () => {
    const leaf = fromPartial<Positionable>({ pinned: false })
    const hiddenChild = fromPartial<Positionable>({ pinned: false })
    const pinned = fromPartial<Positionable>({
      pinned: true,
      children: new Set([leaf, hiddenChild])
    })
    const parent = fromPartial<Positionable>({
      pinned: false,
      children: new Set([leaf, pinned])
    })

    const result = getAllNestedItems(new Set([parent, leaf]))

    expect(result).toEqual(new Set([parent, leaf]))
    expect(result.has(hiddenChild)).toBe(false)
  })
})

describe('findFirstNode', () => {
  it('returns the first graph node from a mixed collection', () => {
    const node = new LGraphNode('node')

    expect(findFirstNode([{ pinned: false } as Positionable, node])).toBe(node)
  })

  it('returns undefined when no graph node is present', () => {
    expect(findFirstNode([{ pinned: false } as Positionable])).toBeUndefined()
  })
})

describe('findFreeSlotOfType', () => {
  interface Slot {
    type: string
    links: number[]
  }

  const hasNoLinks = (slot: Slot) => slot.links.length === 0

  it('returns undefined for an empty slot list', () => {
    expect(findFreeSlotOfType([], 'IMAGE', hasNoLinks)).toBeUndefined()
  })

  it('prefers the first free exact type match', () => {
    const slots = [
      { type: 'IMAGE', links: [1] },
      { type: 'IMAGE', links: [] }
    ]

    expect(findFreeSlotOfType(slots, 'IMAGE', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })

  it('falls back to a free wildcard before an occupied exact slot', () => {
    const slots = [
      { type: 'IMAGE', links: [1] },
      { type: '*', links: [] }
    ]

    expect(findFreeSlotOfType(slots, 'IMAGE', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })

  it('falls back to an occupied exact slot before an occupied wildcard', () => {
    const slots = [
      { type: '*', links: [1] },
      { type: 'IMAGE', links: [2] }
    ]

    expect(findFreeSlotOfType(slots, 'IMAGE', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })

  it('falls back to an occupied wildcard when no exact slot matches', () => {
    const slots = [
      { type: 'LATENT', links: [1] },
      { type: '*', links: [2] }
    ]

    expect(findFreeSlotOfType(slots, 'IMAGE', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })
})
