import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { createLGraphState, mintNodeId } from '@/lib/litegraph/src/idAllocation'

/**
 * PM-1251's root cause at the unit level: `idAllocation.ts`'s node-id
 * counter is minted purely from LOCAL state (`++state.lastNodeId`), with no
 * reservation against, or awareness of, an id a DIFFERENT actor (the
 * server-side agent) is independently minting for the same shared doc.
 * `observeNodeId` only ever raises this graph's own counter to match an id
 * it has already SEEN materialize — it cannot close the window before that
 * frame arrives, which is exactly the race PM-1251 reports: a local
 * duplicate mints before the agent's own concurrent add_node is observed.
 *
 * This property pins that gap directly, independent of the CRDT/materializer
 * plumbing the Playwright repro (`agentNodeIdCollision.spec.ts`) exercises
 * end to end: whenever two actors' counters share the same last-observed
 * value and each mints once before observing the other's mint, they produce
 * the IDENTICAL id. It is expected to currently PASS — that is the proof.
 * A fix that gives mintNodeId real collision avoidance (e.g. an actor-scoped
 * namespace, or a mint-time reservation round trip) should make this
 * property's premise stop holding, at which point it should be replaced
 * with a property asserting the new invariant, not deleted outright.
 */
describe('idAllocation has no collision avoidance against a concurrent external mint (PM-1251)', () => {
  it('mints the same id a same-baseline independent actor already claimed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (lastObservedId) => {
        // Both the frontend's graph and the server-side agent last
        // synced the doc at the same node-id high-water mark — the
        // ordinary starting condition, not an edge case.
        const frontend = createLGraphState()
        frontend.lastNodeId = lastObservedId

        // The agent mints its own next id from that SAME baseline,
        // independently, over a channel this graph's counter cannot see.
        const agentMintedId = lastObservedId + 1

        // The frontend mints locally in the same window, before any
        // frame carrying the agent's id ever reaches `observeNodeId`.
        const frontendMintedId = Number(mintNodeId(frontend))

        return frontendMintedId === agentMintedId
      })
    )
  })

  it('keeps colliding across a run of independent local mints, not just the first', () => {
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
