import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_RESERVED_BIT,
  createLGraphState,
  findNextAvailableId,
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
    const reservedIds = new Set<number>()

    expect([
      mintNodeId(state, 'sequential', reservedIds),
      mintNodeId(state, 'sequential', reservedIds)
    ]).toEqual(['1', '2'])
    expect([
      mintGroupId(state, reservedIds),
      mintGroupId(state, reservedIds)
    ]).toEqual([1, 2])
    expect([
      mintLinkId(state, reservedIds),
      mintLinkId(state, reservedIds)
    ]).toEqual([1, 2])
    expect([
      mintRerouteId(state, reservedIds),
      mintRerouteId(state, reservedIds)
    ]).toEqual([1, 2])
  })

  it("mints from a disjoint range in 'crdt-disjoint' mode, ignoring lastNodeId", () => {
    const state = createLGraphState()
    state.lastNodeId = 5

    const id = BigInt(mintNodeId(state, 'crdt-disjoint', new Set()))

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

  it.for([
    {
      name: 'node',
      observe: (state: ReturnType<typeof createLGraphState>, value: number) =>
        observeNodeId(state, toNodeId(value)),
      mint: (state: ReturnType<typeof createLGraphState>) =>
        mintNodeId(state, 'sequential', new Set())
    },
    {
      name: 'group',
      observe: (state: ReturnType<typeof createLGraphState>, value: number) =>
        observeGroupId(state, toGroupId(value)),
      mint: (state: ReturnType<typeof createLGraphState>) =>
        mintGroupId(state, new Set())
    },
    {
      name: 'link',
      observe: (state: ReturnType<typeof createLGraphState>, value: number) =>
        observeLinkId(state, toLinkId(value)),
      mint: (state: ReturnType<typeof createLGraphState>) =>
        mintLinkId(state, new Set())
    },
    {
      name: 'reroute',
      observe: (state: ReturnType<typeof createLGraphState>, value: number) =>
        observeRerouteId(state, toRerouteId(value)),
      mint: (state: ReturnType<typeof createLGraphState>) =>
        mintRerouteId(state, new Set())
    }
  ])(
    'continues $name allocation above the former limit',
    ({ observe, mint }) => {
      const state = createLGraphState()
      observe(state, 100_000_001)

      expect(Number(mint(state))).toBe(100_000_002)
    }
  )

  it.for([
    {
      name: 'node',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastNodeId = Number.MAX_SAFE_INTEGER
      },
      mint: (
        state: ReturnType<typeof createLGraphState>,
        reservedIds: ReadonlySet<number>
      ) => mintNodeId(state, 'sequential', reservedIds)
    },
    {
      name: 'group',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastGroupId = Number.MAX_SAFE_INTEGER
      },
      mint: mintGroupId
    },
    {
      name: 'link',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastLinkId = toLinkId(Number.MAX_SAFE_INTEGER)
      },
      mint: mintLinkId
    },
    {
      name: 'reroute',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastRerouteId = toRerouteId(Number.MAX_SAFE_INTEGER)
      },
      mint: mintRerouteId
    }
  ])(
    'wraps $name allocation to an available safe ID',
    ({ setCounter, mint }) => {
      const state = createLGraphState()
      setCounter(state)

      expect(Number(mint(state, new Set([1])))).toBe(2)
    }
  )

  it('checks the candidate after the last reserved ID', () => {
    expect(findNextAvailableId(new Set([1, 2, 3]), 1)).toBe(4)
  })

  it('keeps searching past the reported set size', () => {
    const occupiedIds = new Set([1])
    vi.spyOn(occupiedIds, 'has')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false)

    expect(findNextAvailableId(occupiedIds, 1)).toBe(3)
  })

  it('skips a reserved ID above a stale counter', () => {
    const state = createLGraphState()
    state.lastGroupId = 1

    expect(mintGroupId(state, new Set([2]))).toBe(3)
  })

  it('checks thunk reservations before taking the fast path', () => {
    const state = createLGraphState()
    let collections = 0
    const collectReservedIds = () => {
      collections++
      return new Set([1])
    }

    expect(mintGroupId(state, collectReservedIds)).toBe(2)
    expect(collections).toBe(2)

    state.lastGroupId = Number.MAX_SAFE_INTEGER
    expect(mintGroupId(state, collectReservedIds)).toBe(2)
    expect(collections).toBe(3)
  })

  it('checks an indexed reservation without collecting on the fast path', () => {
    const state = createLGraphState()
    state.lastGroupId = 1
    let collections = 0
    const reservedIds = {
      has: (id: number) => id === 99,
      collect: () => {
        collections++
        return new Set([99])
      }
    }

    expect(mintGroupId(state, reservedIds)).toBe(2)
    expect(collections).toBe(0)

    state.lastGroupId = Number.MAX_SAFE_INTEGER
    expect(mintGroupId(state, reservedIds)).toBe(1)
    expect(collections).toBe(1)
  })

  it('skips an occupied indexed fast-path candidate', () => {
    const state = createLGraphState()
    state.lastGroupId = 1
    const reservedIds = {
      has: (id: number) => id === 2,
      collect: () => new Set([2])
    }

    expect(mintGroupId(state, reservedIds)).toBe(3)
  })

  it.for([
    {
      name: 'node',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastNodeId = Number.MAX_SAFE_INTEGER
      },
      mint: (state: ReturnType<typeof createLGraphState>) =>
        Number(mintNodeId(state, 'sequential', new Set()))
    },
    {
      name: 'group',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastGroupId = Number.MAX_SAFE_INTEGER
      },
      mint: (state: ReturnType<typeof createLGraphState>) =>
        Number(mintGroupId(state, new Set()))
    },
    {
      name: 'link',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastLinkId = toLinkId(Number.MAX_SAFE_INTEGER)
      },
      mint: (state: ReturnType<typeof createLGraphState>) =>
        Number(mintLinkId(state, new Set()))
    },
    {
      name: 'reroute',
      setCounter: (state: ReturnType<typeof createLGraphState>) => {
        state.lastRerouteId = toRerouteId(Number.MAX_SAFE_INTEGER)
      },
      mint: (state: ReturnType<typeof createLGraphState>) =>
        Number(mintRerouteId(state, new Set()))
    }
  ])('advances $name allocation after wrapping', ({ setCounter, mint }) => {
    const state = createLGraphState()
    setCounter(state)

    expect([mint(state), mint(state)]).toEqual([1, 2])
  })

  it('wraps a reserved maximum candidate to the first available ID', () => {
    expect(
      findNextAvailableId(
        new Set([Number.MAX_SAFE_INTEGER, 1]),
        Number.MAX_SAFE_INTEGER
      )
    ).toBe(2)
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
})
