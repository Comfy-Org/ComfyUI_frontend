import { describe, expect, expectTypeOf, it } from 'vitest'

import { asNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import { getSlotKey } from './slotIdentifier'

describe('getSlotKey', () => {
  it('accepts branded NodeId values', () => {
    const nodeId = asNodeId(7)

    expect(getSlotKey(nodeId, 2, true)).toBe('7-in-2')
    expect(getSlotKey({ nodeId, index: 3, isInput: false })).toBe('7-out-3')
  })

  it('does not accept raw string node ids', () => {
    type FirstParameter = Parameters<typeof getSlotKey>[0]

    expectTypeOf<NodeId>().toMatchTypeOf<FirstParameter>()
    expectTypeOf<string>().not.toMatchTypeOf<FirstParameter>()
  })
})
