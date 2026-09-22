import { describe, expect, it } from 'vitest'

import {
  AGENT_RESERVED_BIT,
  createLGraphState,
  isReservedBitRangeNodeId,
  matchesReservedBitConvention,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId
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

  it("mints from a disjoint range in 'crdt-disjoint' mode, ignoring lastNodeId", () => {
    const state = createLGraphState()
    state.lastNodeId = 5

    const id = BigInt(mintNodeId(state, 'crdt-disjoint'))

    expect(state.lastNodeId).toBe(5)
    // Bit 40 clear (never the agent's `2**40 | random52` range), bit 41 set.
    expect((id >> 40n) & 1n).toBe(0n)
    expect((id >> 41n) & 1n).toBe(1n)
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

  describe('isReservedBitRangeNodeId', () => {
    it.for([
      { id: toNodeId(AGENT_RESERVED_BIT.toString()), name: 'the agent floor' },
      {
        id: toNodeId('2e12'),
        name: 'an exponent-form integer above the floor'
      },
      {
        id: toNodeId('4398046511104.'),
        name: 'a trailing decimal point with no fractional digits'
      },
      {
        id: toNodeId('.4398046511104e13'),
        name: 'a leading decimal point with an exponent'
      },
      {
        id: toNodeId('2.0e12'),
        name: 'a decimal-mantissa exponent literal above the floor'
      },
      {
        id: toNodeId('20000000000000e-1'),
        name: 'a negative-exponent literal above the floor'
      },
      {
        id: toNodeId(Number.MAX_SAFE_INTEGER.toString()),
        name: 'Number.MAX_SAFE_INTEGER, the last safe integer'
      }
    ])('is true for $name', ({ id }) => {
      expect(isReservedBitRangeNodeId(id)).toBe(true)
    })

    it.for([
      { id: toNodeId('named'), name: 'a nonnumeric legacy id' },
      { id: toNodeId('57:3'), name: 'a subgraph-scoped address' },
      {
        id: toNodeId(`${AGENT_RESERVED_BIT.toString()}.0001`),
        name: 'a fractional numeral that only coerces to the floor'
      },
      {
        id: toNodeId((BigInt(Number.MAX_SAFE_INTEGER) + 2n).toString()),
        name: 'an unsafe integer one past Number.MAX_SAFE_INTEGER, even though its rounded value falls in the violating range'
      }
    ])('is false for $name', ({ id }) => {
      expect(isReservedBitRangeNodeId(id)).toBe(false)
    })
  })

  describe('matchesReservedBitConvention', () => {
    it('does not throw, and reports no match, for a fractional numeral that coerces to a value carrying neither reserved bit', () => {
      // `AGENT_RESERVED_BIT << 2n` (bit 42) carries neither the agent's bit
      // 40 nor this app's disjoint-floor bit 41, so a truthful integer at
      // this value would fail the convention too — the point here is only
      // that a fractional string never reaches the bit check at all.
      const violatingFloor = AGENT_RESERVED_BIT << 2n
      const id = toNodeId(`${violatingFloor.toString()}.0001`)

      expect(() => matchesReservedBitConvention(id)).not.toThrow()
      expect(matchesReservedBitConvention(id)).toBe(false)
    })
  })
})
