import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import {
  AGENT_RESERVED_BIT,
  CRDT_DISJOINT_FLOOR,
  createLGraphState,
  mintNodeId
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
            Number(mintNodeId(frontend))
          )
          const agentIds = Array.from({ length: mintCount }, () =>
            Number(mintNodeId(agent))
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

          const frontendMintedId = BigInt(mintNodeId(frontend, 'crdt-disjoint'))

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
            BigInt(mintNodeId(frontend, 'crdt-disjoint'))
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
          BigInt(mintNodeId(frontend, 'crdt-disjoint'))
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
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (mintCount) => {
        const frontend = createLGraphState()
        const ids = Array.from({ length: mintCount }, () =>
          BigInt(mintNodeId(frontend, 'crdt-disjoint'))
        )

        return new Set(ids).size === ids.length
      })
    )
  })
})
