import { describe, expect, it, vi } from 'vitest'

import {
  createLGraphState,
  MINT_ID_CEILING,
  MINT_ID_MIN,
  mintCoordinationFreeId,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId,
  setCoordinationFreeIds
} from '@/lib/litegraph/src/idAllocation'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LinkId } from '@/types/linkId'

describe('idAllocation', () => {
  it('mints increasing ids for each entity kind', () => {
    const state = createLGraphState()

    expect([mintNodeId(state), mintNodeId(state)]).toEqual(['1', '2'])
    expect([mintGroupId(state), mintGroupId(state)]).toEqual([1, 2])
    expect([mintLinkId(state), mintLinkId(state)]).toEqual([1, 2])
    expect([mintRerouteId(state), mintRerouteId(state)]).toEqual([1, 2])
  })

  it('observes higher ids and ignores lower ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(4))
    observeNodeId(state, toNodeId(2))
    observeGroupId(state, toGroupId(5))
    observeGroupId(state, toGroupId(3))
    observeLinkId(state, toLinkId(6))
    observeLinkId(state, toLinkId(4))
    observeRerouteId(state, toRerouteId(7))
    observeRerouteId(state, toRerouteId(5))

    expect(state).toEqual({
      lastGroupId: 5,
      lastNodeId: 4,
      lastLinkId: 6,
      lastRerouteId: 7
    })
  })

  it('observes numeric-string node ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId('12'))
    observeNodeId(state, toNodeId('named'))

    expect(state.lastNodeId).toBe(12)
  })

  it('mints node and link ids from the disjoint range only while armed', () => {
    const state = createLGraphState()
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)

    setCoordinationFreeIds(state, true)
    expect(Number(mintNodeId(state))).toBeGreaterThanOrEqual(MINT_ID_MIN)
    expect(Number(mintLinkId(state))).toBeLessThan(MINT_ID_CEILING)
    expect(state.lastNodeId).toBe(0)
    expect(state.lastLinkId).toBe(0)

    setCoordinationFreeIds(state, false)
    expect(mintNodeId(state)).toBe('1')
    expect(mintLinkId(state)).toBe(1)
    random.mockRestore()
  })

  it('maps the random interval into the safe coordination-free range', () => {
    expect(mintCoordinationFreeId(() => 0)).toBe(MINT_ID_MIN)
    expect(mintCoordinationFreeId(() => 1 - Number.EPSILON)).toBeLessThan(
      MINT_ID_CEILING
    )
    expect(mintCoordinationFreeId(() => 1)).toBeLessThan(MINT_ID_CEILING)
    expect(mintCoordinationFreeId(() => Number.POSITIVE_INFINITY)).toBe(
      MINT_ID_MIN
    )
  })

  it('does not restore minted ids into sequential counters', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(MINT_ID_MIN))
    observeLinkId(state, toLinkId(MINT_ID_MIN))

    expect(mintNodeId(state)).toBe('1')
    expect(mintLinkId(state)).toBe(1)
  })

  it('observes the last legal sequential id and coerces numeric link ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(MINT_ID_MIN - 1))
    observeLinkId(state, String(MINT_ID_MIN - 1) as unknown as LinkId)

    expect(state.lastNodeId).toBe(MINT_ID_MIN - 1)
    expect(state.lastLinkId).toBe(MINT_ID_MIN - 1)
    expect(() => mintNodeId(state)).toThrow(RangeError)
    expect(() => mintLinkId(state)).toThrow(RangeError)
  })

  it('ignores poisoned serialized counters and deprecated setter writes', () => {
    const graph = new LGraph()
    const poisoned = MINT_ID_MIN + 5

    graph.configure({
      ...new LGraph().asSerialisable(),
      state: {
        lastGroupId: 0,
        lastNodeId: poisoned,
        lastLinkId: toLinkId(poisoned),
        lastRerouteId: toRerouteId(0)
      }
    })
    graph.last_node_id = poisoned
    graph.last_link_id = toLinkId(poisoned)

    expect(Number(mintNodeId(graph.state))).toBeLessThan(MINT_ID_MIN)
    expect(Number(mintLinkId(graph.state))).toBeLessThan(MINT_ID_MIN)
  })

  it('ignores deprecated counter setter coercions and negative writes', () => {
    const graph = new LGraph()
    graph.state.lastNodeId = 7

    graph.last_node_id = null as unknown as number
    graph.last_link_id = [] as unknown as LinkId
    graph.last_node_id = -1
    graph.last_link_id = -1 as LinkId

    expect(mintNodeId(graph.state)).toBe('8')
    expect(mintLinkId(graph.state)).toBe(1)
  })

  it('fails before sequential counters enter the coordination-free range', () => {
    const state = createLGraphState()
    state.lastNodeId = MINT_ID_MIN - 2
    state.lastLinkId = toLinkId(MINT_ID_MIN - 2)

    expect(mintNodeId(state)).toBe(String(MINT_ID_MIN - 1))
    expect(mintLinkId(state)).toBe(MINT_ID_MIN - 1)
    expect(() => mintNodeId(state)).toThrow(RangeError)
    expect(() => mintLinkId(state)).toThrow(RangeError)
  })
})
