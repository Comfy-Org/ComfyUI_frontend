import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'

import {
  AGENT_RESERVED_BIT,
  CRDT_DISJOINT_FLOOR,
  createLGraphState,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId
} from '@/lib/litegraph/src/idAllocation'

/**
 * The id-collision root cause at the unit level: `idAllocation.ts`'s node-id
 * counter is minted purely from LOCAL state (`++state.lastNodeId`), with no
 * reservation against, or awareness of, an id a DIFFERENT actor (the
 * server-side agent) is independently minting for the same shared doc.
 * `observeNodeId` only ever raises this graph's own counter to match an id
 * it has already SEEN materialize — it cannot close the window before that
 * frame arrives, which is exactly the reported race: a local duplicate
 * mints before the agent's own concurrent add_node is observed.
 *
 * This property pins that gap directly, independent of the CRDT/materializer
 * plumbing the Playwright repro (`agentNodeIdCollision.spec.ts`) exercises
 * end to end: whenever two actors' counters share the same last-observed
 * value and each mints once before observing the other's mint, they produce
 * the IDENTICAL id. This still holds for the DEFAULT `'sequential'` mode,
 * which plain local (non-agent) graphs keep unchanged — the fix below is
 * mode-scoped, not a change to `mintNodeId`'s default behaviour. A graph
 * bound to the agent's collaborative doc now mints in `'crdt-disjoint'` mode
 * instead (see the property below), which is where this gap is actually
 * closed for the real production path.
 */
describe('idAllocation has no collision avoidance against a concurrent external mint', () => {
  // Two states seeded to the same baseline, both minted by the SAME
  // `mintNodeId` call, model "two actors independently running this
  // naive counter" as closely as a single frontend module can: neither
  // side carries an actor identity, so this is not a regression guard
  // that a fix could flip red — 'sequential' mode is deliberately left
  // unchanged by the 'crdt-disjoint' fix below and is not expected to stop
  // colliding. It pins that accepted, by-design gap precisely, in place of
  // the two overlapping variants of it this used to carry (a first-mint-only
  // check against a hardcoded `lastObservedId + 1`, and a redundant
  // multi-mint run of the same comparison) which added no signal beyond
  // this one.
  it('keeps colliding across a run of independent same-baseline local mints', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        (lastObservedId, mintCount) => {
          const frontend = createLGraphState()
          frontend.lastNodeId = lastObservedId
          const agent = createLGraphState()
          agent.lastNodeId = lastObservedId

          const frontendIds = Array.from({ length: mintCount }, () =>
            Number(mintNodeId(frontend, 'sequential', new Set()))
          )
          const agentIds = Array.from({ length: mintCount }, () =>
            Number(mintNodeId(agent, 'sequential', new Set()))
          )

          return frontendIds.every((id, index) => id === agentIds[index])
        }
      )
    )
  })
})

/**
 * `'crdt-disjoint'` mode is the fix for the gap above: a graph bound to the
 * agent's collaborative doc mints from it instead of the default
 * `'sequential'` counter, so a local mint can never land on an id the agent
 * independently mints for the same doc — by construction (bit 40 clear vs.
 * the agent's bit 40 always set), not by low collision odds.
 */
describe("mintNodeId's 'crdt-disjoint' mode never collides with a simulated agent-style mint", () => {
  /**
   * Mirrors comfy-cli's `mint_id()`: `2**40 | random52`, bit 40 always set.
   * Imports the production `AGENT_RESERVED_BIT` rather than respelling the
   * literal, so this can't independently drift from the constant it's
   * meant to track (it still can't verify comfy-cli's actual mint - see
   * `idAllocation.ts`'s doc comment on `AGENT_RESERVED_BIT`).
   */
  const agentMintedId = (): fc.Arbitrary<bigint> =>
    fc
      .bigInt({ min: 0n, max: (1n << 52n) - 1n })
      .map((random) => AGENT_RESERVED_BIT | random)

  it('never lands on an id a simulated agent mint claims', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        agentMintedId(),
        (lastObservedId, agentId) => {
          // An arbitrary prior high-water mark — irrelevant here since this
          // mode never reads `lastNodeId`, unlike 'sequential' above.
          const frontend = createLGraphState()
          frontend.lastNodeId = lastObservedId

          const frontendMintedId = BigInt(
            mintNodeId(frontend, 'crdt-disjoint', new Set())
          )

          return frontendMintedId !== agentId
        }
      )
    )
  })

  it('keeps every id in a run of local mints disjoint from a batch of agent-style mints', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(agentMintedId(), { minLength: 1, maxLength: 20 }),
        (mintCount, agentIds) => {
          const frontend = createLGraphState()
          const frontendIds = Array.from({ length: mintCount }, () =>
            BigInt(mintNodeId(frontend, 'crdt-disjoint', new Set()))
          )
          const agentIdSet = new Set(agentIds)
          return frontendIds.every((id) => !agentIdSet.has(id))
        }
      )
    )
  })

  /**
   * The two properties above only ever check a minted id against
   * INDEPENDENTLY RANDOM agent-style ids, by equality or set membership. A
   * wrong allocator that mints a single hardcoded id passes both trivially:
   * exact equality with any one of a handful of random 52-bit samples is
   * astronomically unlikely whether or not that constant actually sits in
   * the disjoint partition. So does an allocator that mints the SAME id on
   * every call within a run — nothing above ever mints twice and compares
   * the two results. These two properties assert the partition invariant
   * and cross-call uniqueness directly, so a constant or repeating
   * allocator fails them even though it would slip past the properties
   * above.
   */
  it('every crdt-disjoint mint has bit 40 clear, bit 41 set, and is a safe integer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (mintCount) => {
        const frontend = createLGraphState()
        const ids = Array.from({ length: mintCount }, () =>
          BigInt(mintNodeId(frontend, 'crdt-disjoint', new Set()))
        )

        return ids.every(
          (id) =>
            Number.isSafeInteger(Number(id)) &&
            (id & AGENT_RESERVED_BIT) === 0n &&
            (id & CRDT_DISJOINT_FLOOR) !== 0n
        )
      })
    )
  })

  it('never repeats an id across a run of local crdt-disjoint mints', () => {
    const frontend = createLGraphState()
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const first = mintNodeId(frontend, 'crdt-disjoint', new Set())
    const second = mintNodeId(
      frontend,
      'crdt-disjoint',
      new Set([Number(first)])
    )

    expect(second).not.toBe(first)
    expect(BigInt(second) & AGENT_RESERVED_BIT).toBe(0n)
    expect(BigInt(second) & CRDT_DISJOINT_FLOOR).not.toBe(0n)
  })
})

/**
 * The production failure (FE-3007) generalized past the one trace in
 * `LGraph.test.ts`. Observation has no ceiling, so any id a *different*
 * mint convention produced — the agent's `2**40 | random52`, or this app's
 * own `crdt-disjoint` floor at 2^41 — becomes a sequential counter's
 * high-water mark the moment it is seen. Minting then has to keep working
 * from there.
 *
 * Stated over the whole reserved range rather than at one sampled value,
 * and over all four id classes, because `findNextAvailableId` is shared by
 * every one of them: the four Sentry groups in this family entered through
 * three different entry points and two different id classes, and differed
 * only in which `remap*` called the allocator. Any reintroduced fixed
 * bound below `Number.MAX_SAFE_INTEGER` fails this, wherever it is put.
 */
describe('sequential minting survives a counter raised into the reserved mint range', () => {
  /**
   * The whole range a reserved-bit id can occupy, from the agent's mint
   * floor to just below the safe-integer boundary — deliberately not just
   * the production samples, so a ceiling placed anywhere in between is
   * caught. The top of the range is held two below `MAX_SAFE_INTEGER` so a
   * mint has somewhere to go without exercising the separate wrap path.
   */
  const reservedRangeHighWaterMark = (): fc.Arbitrary<number> =>
    fc.integer({
      min: Number(AGENT_RESERVED_BIT),
      max: Number.MAX_SAFE_INTEGER - 2
    })

  const minters = [
    {
      name: 'node',
      mint: (lastId: number, reserved: ReadonlySet<number>) => {
        const state = createLGraphState()
        state.lastNodeId = lastId
        return Number(mintNodeId(state, 'sequential', reserved))
      }
    },
    {
      name: 'link',
      mint: (lastId: number, reserved: ReadonlySet<number>) => {
        const state = createLGraphState()
        state.lastLinkId = toLinkId(lastId)
        return Number(mintLinkId(state, reserved))
      }
    },
    {
      name: 'group',
      mint: (lastId: number, reserved: ReadonlySet<number>) => {
        const state = createLGraphState()
        state.lastGroupId = lastId
        return Number(mintGroupId(state, reserved))
      }
    },
    {
      name: 'reroute',
      mint: (lastId: number, reserved: ReadonlySet<number>) => {
        const state = createLGraphState()
        state.lastRerouteId = toRerouteId(lastId)
        return Number(mintRerouteId(state, reserved))
      }
    }
  ] as const

  it.for(minters)(
    'mints a fresh safe $name id above any reserved-range high-water mark',
    ({ mint }) => {
      fc.assert(
        fc.property(reservedRangeHighWaterMark(), (lastId) => {
          const id = mint(lastId, new Set())
          return Number.isSafeInteger(id) && id > lastId
        })
      )
    }
  )

  /**
   * The property above would also pass an allocator that returned
   * `lastId + 1` without consulting the reservation set. Reserving the
   * immediate successor forces the collision-recovery path to run from a
   * reserved-range start, which is where the former ceiling threw.
   */
  it.for(minters)(
    'recovers a free $name id when the successor of a reserved-range mark is taken',
    ({ mint }) => {
      fc.assert(
        fc.property(reservedRangeHighWaterMark(), (lastId) => {
          const reserved = new Set([lastId + 1])
          const id = mint(lastId, reserved)
          return Number.isSafeInteger(id) && !reserved.has(id) && id !== lastId
        })
      )
    }
  )
})
