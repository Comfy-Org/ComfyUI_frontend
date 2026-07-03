import { describe, expect, it } from 'vitest'

import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockPositionable } from '@/utils/__tests__/litegraphTestUtils'

import {
  findFirstNode,
  findFreeSlotOfType,
  getAllNestedItems
} from './collections'

describe('getAllNestedItems', () => {
  it('returns an empty set when items are not supplied', () => {
    expect(getAllNestedItems(undefined).size).toBe(0)
  })

  it('excludes pinned items', () => {
    const pinned = createMockPositionable({ pinned: true })
    const unpinned = createMockPositionable()

    const result = getAllNestedItems(new Set([pinned, unpinned]))

    expect(result.has(pinned)).toBe(false)
    expect(result.has(unpinned)).toBe(true)
  })

  it('recurses into children and deduplicates shared children', () => {
    const shared = createMockPositionable()
    const parentA: Positionable = createMockPositionable({
      children: new Set([shared])
    })
    const parentB: Positionable = createMockPositionable({
      children: new Set([shared])
    })

    const result = getAllNestedItems(new Set([parentA, parentB]))

    expect(result).toEqual(new Set([parentA, parentB, shared]))
  })

  it('does not recurse into pinned children', () => {
    const pinnedChild = createMockPositionable({ pinned: true })
    const parent: Positionable = createMockPositionable({
      children: new Set([pinnedChild])
    })

    const result = getAllNestedItems(new Set([parent]))

    expect(result).toEqual(new Set([parent]))
  })
})

describe('findFirstNode', () => {
  it('returns the first LGraphNode in the collection', () => {
    const notANode = createMockPositionable()
    const node = new LGraphNode('Test Node')
    const otherNode = new LGraphNode('Other Node')

    expect(findFirstNode([notANode, node, otherNode])).toBe(node)
  })

  it('returns undefined when the collection has no nodes', () => {
    expect(findFirstNode([createMockPositionable()])).toBeUndefined()
    expect(findFirstNode([])).toBeUndefined()
  })
})

describe('findFreeSlotOfType', () => {
  interface TestSlot {
    type: string
    free: boolean
  }

  const hasNoLinks = (slot: TestSlot) => slot.free

  it('returns undefined when no slots are supplied', () => {
    expect(findFreeSlotOfType([], 'A', hasNoLinks)).toBeUndefined()
    expect(findFreeSlotOfType(undefined, 'A', hasNoLinks)).toBeUndefined()
  })

  it('returns the first free slot with an exact type match', () => {
    const slots: TestSlot[] = [
      { type: 'a', free: false },
      { type: 'a', free: true }
    ]

    expect(findFreeSlotOfType(slots, 'A', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })

  it('falls back to an occupied slot with a matching type', () => {
    const slots: TestSlot[] = [{ type: 'a', free: false }]

    expect(findFreeSlotOfType(slots, 'A', hasNoLinks)).toEqual({
      index: 0,
      slot: slots[0]
    })
  })

  it('falls back to a free wildcard slot when no types match', () => {
    const slots: TestSlot[] = [
      { type: 'b', free: true },
      { type: '*', free: true }
    ]

    expect(findFreeSlotOfType(slots, 'A', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })

  it('falls back to an occupied wildcard slot as a last resort', () => {
    const slots: TestSlot[] = [{ type: '*', free: false }]

    expect(findFreeSlotOfType(slots, 'A', hasNoLinks)).toEqual({
      index: 0,
      slot: slots[0]
    })
  })

  it('matches wildcard search types against occupied concrete slots', () => {
    const slots: TestSlot[] = [{ type: 'b', free: false }]

    expect(findFreeSlotOfType(slots, '*', hasNoLinks)).toEqual({
      index: 0,
      slot: slots[0]
    })
  })

  it('returns undefined when nothing matches', () => {
    const slots: TestSlot[] = [{ type: 'b', free: true }]

    expect(findFreeSlotOfType(slots, 'A', hasNoLinks)).toBeUndefined()
  })

  it('matches any comma-delimited type in the search list', () => {
    const slots: TestSlot[] = [
      { type: 'c', free: true },
      { type: 'b,c', free: true }
    ]

    expect(findFreeSlotOfType(slots, 'A,B', hasNoLinks)).toEqual({
      index: 1,
      slot: slots[1]
    })
  })
})
