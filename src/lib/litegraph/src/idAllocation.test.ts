import { describe, expect, it } from 'vitest'

import {
  AGENT_RESERVED_BIT,
  MAX_ID,
  cloneLGraphState,
  commitLGraphState,
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
  observeRerouteId,
  releaseGroupId,
  releaseLinkId,
  releaseNodeId,
  releaseRerouteId
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
      lastRerouteId: 7,
      freeNodeIds: new Set(),
      freeGroupIds: new Set(),
      freeLinkIds: new Set(),
      freeRerouteIds: new Set()
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
        name: 'an unsafe integer two past Number.MAX_SAFE_INTEGER (9007199254740993), chosen because Number() rounds it down to 9007199254740992 and it still falls in the violating range'
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

  describe('id recycling', () => {
    it.for([
      {
        release: (state: ReturnType<typeof createLGraphState>) =>
          releaseNodeId(state, toNodeId(2)),
        mint: mintNodeId,
        expected: ['1', '2', '3', '2', '4'],
        name: 'node'
      },
      {
        release: (state: ReturnType<typeof createLGraphState>) =>
          releaseGroupId(state, toGroupId(2)),
        mint: mintGroupId,
        expected: [1, 2, 3, 2, 4],
        name: 'group'
      },
      {
        release: (state: ReturnType<typeof createLGraphState>) =>
          releaseLinkId(state, toLinkId(2)),
        mint: mintLinkId,
        expected: [1, 2, 3, 2, 4],
        name: 'link'
      },
      {
        release: (state: ReturnType<typeof createLGraphState>) =>
          releaseRerouteId(state, toRerouteId(2)),
        mint: mintRerouteId,
        expected: [1, 2, 3, 2, 4],
        name: 'reroute'
      }
    ])(
      'reuses a freed $name ID before minting past the counter',
      ({ release, mint, expected }) => {
        const state = createLGraphState()
        expect([mint(state), mint(state), mint(state)]).toEqual(
          expected.slice(0, 3)
        )

        release(state)
        expect(mint(state)).toEqual(expected[3])
        expect(mint(state)).toEqual(expected[4])
      }
    )

    it('ignores releasing a nonnumeric legacy node ID', () => {
      const state = createLGraphState()
      releaseNodeId(state, toNodeId('named'))
      expect(state.freeNodeIds.size).toBe(0)
    })

    it('never recycles an ID in the agent/CRDT reserved-bit range', () => {
      const state = createLGraphState()
      releaseNodeId(state, toNodeId(AGENT_RESERVED_BIT.toString()))
      expect(state.freeNodeIds.size).toBe(0)
    })

    it('drops a freed ID from the pool once it is observed as in use again', () => {
      const state = createLGraphState()
      mintNodeId(state)
      releaseNodeId(state, toNodeId(1))
      expect(state.freeNodeIds.has(1)).toBe(true)

      observeNodeId(state, toNodeId(1))
      expect(state.freeNodeIds.has(1)).toBe(false)
    })
  })

  describe('counter clamping', () => {
    it.for([
      {
        observe: (state: ReturnType<typeof createLGraphState>) =>
          observeNodeId(state, toNodeId(MAX_ID + 1)),
        read: (state: ReturnType<typeof createLGraphState>) => state.lastNodeId,
        name: 'node'
      },
      {
        observe: (state: ReturnType<typeof createLGraphState>) =>
          observeGroupId(state, toGroupId(MAX_ID + 1)),
        read: (state: ReturnType<typeof createLGraphState>) =>
          state.lastGroupId,
        name: 'group'
      },
      {
        observe: (state: ReturnType<typeof createLGraphState>) =>
          observeLinkId(state, toLinkId(MAX_ID + 1)),
        read: (state: ReturnType<typeof createLGraphState>) =>
          Number(state.lastLinkId),
        name: 'link'
      },
      {
        observe: (state: ReturnType<typeof createLGraphState>) =>
          observeRerouteId(state, toRerouteId(MAX_ID + 1)),
        read: (state: ReturnType<typeof createLGraphState>) =>
          Number(state.lastRerouteId),
        name: 'reroute'
      }
    ])(
      'clamps an absurd incoming $name counter to MAX_ID',
      ({ observe, read }) => {
        const state = createLGraphState()
        observe(state)
        expect(read(state)).toBe(MAX_ID)
      }
    )

    it('rejects a negative counter candidate outright', () => {
      const state = createLGraphState()
      observeNodeId(state, toNodeId(-5))
      expect(state.lastNodeId).toBe(0)
    })
  })

  describe('cloneLGraphState / commitLGraphState', () => {
    it('leaves the original untouched until explicitly committed', () => {
      const state = createLGraphState()
      const working = cloneLGraphState(state)

      mintNodeId(working)
      mintNodeId(working)

      expect(state.lastNodeId).toBe(0)
      expect(working.lastNodeId).toBe(2)

      commitLGraphState(state, working)
      expect(state.lastNodeId).toBe(2)
    })

    it('clones free-id sets so mutating the copy cannot affect the original', () => {
      const state = createLGraphState()
      mintNodeId(state)
      releaseNodeId(state, toNodeId(1))

      const working = cloneLGraphState(state)
      mintNodeId(working)

      expect(state.freeNodeIds.has(1)).toBe(true)
      expect(working.freeNodeIds.has(1)).toBe(false)
    })
  })
})
