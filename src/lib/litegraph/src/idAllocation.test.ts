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
  })

  it('does not restore minted ids into sequential counters', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(MINT_ID_MIN))
    observeLinkId(state, toLinkId(MINT_ID_MIN))

    expect(mintNodeId(state)).toBe('1')
    expect(mintLinkId(state)).toBe(1)
  })
})
