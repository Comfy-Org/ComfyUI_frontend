import { describe, expect } from 'vitest'

import { LLink } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })
  test('matches numeric caller ids after endpoint normalization', () => {
    const link = new LLink(toLinkId(1), 'float', 4, 2, 5, 3)

    expect(link.hasOrigin(4, 2)).toBe(true)
    expect(link.hasTarget(5, 3)).toBe(true)
  })

  test('exposes topology fields backed by a single _state object', () => {
    const link = new LLink(toLinkId(1), 'INT', 5, 0, 9, 2)
    expect(link.origin_id).toBe(toNodeId(5))
    link.target_slot = 4
    expect(link._state.targetSlot).toBe(4)
    expect(link.asSerialisable()).toMatchObject({
      id: toLinkId(1),
      origin_id: 5,
      target_slot: 4,
      type: 'INT'
    })
  })
})
