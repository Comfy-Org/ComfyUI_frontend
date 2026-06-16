import { describe, expect } from 'vitest'

import {
  asNodeId,
  FLOATING_LINK_NODE_ID,
  LLink,
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_OUTPUT_ID,
  SUBGRAPH_OUTPUT_NODE_ID
} from '@/lib/litegraph/src/litegraph'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(1, 'float', asNodeId(4), 2, asNodeId(5), 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(1, 'float', asNodeId(4), 2, asNodeId(5), 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  describe('node-id branding at the edges', () => {
    test('brands numeric endpoints into NodeId at construction', () => {
      const link = new LLink(1, 'float', 4, 2, 5, 3)
      expect(link.origin_id).toBe(asNodeId(4))
      expect(link.target_id).toBe(asNodeId(5))
      expect(typeof link.origin_id).toBe('string')
    })

    test('brands the floating sentinel into FLOATING_LINK_NODE_ID', () => {
      const link = new LLink(1, 'float', -1, -1, asNodeId(5), 3)
      expect(link.origin_id).toBe(FLOATING_LINK_NODE_ID)
      expect(link.isFloatingOutput).toBe(true)
    })

    test('brands subgraph IO sentinels into branded sentinels', () => {
      const link = new LLink(
        1,
        'float',
        SUBGRAPH_INPUT_ID,
        0,
        SUBGRAPH_OUTPUT_ID,
        0
      )
      expect(link.origin_id).toBe(SUBGRAPH_INPUT_NODE_ID)
      expect(link.target_id).toBe(SUBGRAPH_OUTPUT_NODE_ID)
      expect(link.originIsIoNode).toBe(true)
      expect(link.targetIsIoNode).toBe(true)
    })

    test('serializes sentinels as branded string ids', () => {
      const floating = new LLink(1, 'float', -1, -1, asNodeId(5), 3)
      expect(floating.asSerialisable().origin_id).toBe(FLOATING_LINK_NODE_ID)
      expect(floating.serialize()[1]).toBe(FLOATING_LINK_NODE_ID)

      const io = new LLink(
        2,
        'float',
        SUBGRAPH_INPUT_ID,
        0,
        SUBGRAPH_OUTPUT_ID,
        0
      )
      const serialised = io.asSerialisable()
      expect(serialised.origin_id).toBe(SUBGRAPH_INPUT_NODE_ID)
      expect(serialised.target_id).toBe(SUBGRAPH_OUTPUT_NODE_ID)
    })

    test('serializes real node ids as branded strings (round-trips)', () => {
      const link = new LLink(1, 'float', 4, 2, 5, 3)
      const restored = LLink.create(link.asSerialisable())
      expect(restored.origin_id).toBe(asNodeId(4))
      expect(restored.target_id).toBe(asNodeId(5))
    })
  })
})
