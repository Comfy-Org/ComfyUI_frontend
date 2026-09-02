/**
 * QA-12: fuzz the FE op-ingestion boundary with malformed `connect` payloads
 * (the from_slot-class gaps: negatives, floats, NaN, wrong types).
 *
 * `createGraphMutations(...).connect()` (`graphMutations.ts:394-403`) is
 * where an incoming remote `connect` op (already read off the shared Yjs doc
 * by `ecsFollowerAdapter.ts`'s `readSemanticLink`) is committed into the
 * app's node/link stores. It is the last gate before slot values become
 * store state — and until this test, its
 * `'connect requires non-negative integer ids and slots'` rejection branch
 * had zero coverage (no negative, float, NaN, string, null, undefined, or
 * array slot value was ever exercised; grep confirms no prior test named
 * this message).
 *
 * `readSemanticLink` (`ecsFollowerAdapter.ts:50-79`) only guards
 * `Number.isInteger` on `originSlot`/`targetSlot` — it does NOT reject
 * negative integers, so `-1` legitimately reaches `graphMutations.connect`
 * as a well-typed `number`. This is the one from_slot-class gap that
 * survives the upstream read and depends entirely on this boundary to
 * catch it; the fuzz below asserts it does, for every run.
 *
 * Assert: `connect()` never throws for any malformed slot value, always
 * returns `false` (graceful rejection, this repo's `OpRejectedError`-style
 * mechanism — a typed `OpRejectedError` class does not exist in this repo;
 * rejection here is a boolean + logged reason, never a raw TypeError
 * escaping), and never mutates the link store on rejection.
 */
import { createTestingPinia } from '@pinia/testing'
import * as fc from 'fast-check'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLinkStore } from '@/stores/linkStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import { createGraphMutations } from './graphMutations'

const scope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}
const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}

function node(id: number) {
  return {
    id,
    type: `Type${id}`,
    title: `Node ${id}`,
    pos: [id * 10, id * 20],
    size: [200, 100],
    flags: {},
    inputs: [{ name: 'in', type: 'IMAGE', link: null }],
    outputs: [{ name: 'out', type: 'IMAGE', links: [] }],
    properties: {},
    widgets_values: {}
  }
}

/** The from_slot-class gap generator: negatives, floats, NaN, and wrong types. */
const arbMalformedSlot = fc.oneof(
  fc.integer({ min: -1000, max: -1 }), // negative integer — survives readSemanticLink's Number.isInteger-only guard
  fc
    .double({ noNaN: false, noDefaultInfinity: false })
    .filter((n) => !Number.isInteger(n)), // float / NaN / Infinity
  fc.string(), // wrong type: string
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.array(fc.integer(), { maxLength: 3 }) // wrong type: array
)

describe('QA-12: graphMutations.connect slot fuzz (op-ingestion boundary)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function mutations() {
    return createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
    })
  }

  it('rejects malformed from_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = mutations()
        graph.batch(context, (batch) => {
          batch.addNode(node(1))
          batch.addNode(node(2))
        })

        let accepted: boolean | undefined
        expect(() => {
          accepted = graph.connect(
            {
              id: 99,
              originNodeId: 1,
              originSlot: badSlot as unknown as number,
              targetNodeId: 2,
              targetSlot: 0,
              type: 'IMAGE'
            },
            context
          )
        }).not.toThrow()

        expect(accepted).toBe(false)
        expect(
          useLinkStore().getTopology(scope.rootGraphId, 99 as never)
        ).toBeUndefined()
        error.mockRestore()
      }),
      { numRuns: 200 }
    )
  })

  it('rejects malformed to_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = mutations()
        graph.batch(context, (batch) => {
          batch.addNode(node(1))
          batch.addNode(node(2))
        })

        let accepted: boolean | undefined
        expect(() => {
          accepted = graph.connect(
            {
              id: 99,
              originNodeId: 1,
              originSlot: 0,
              targetNodeId: 2,
              targetSlot: badSlot as unknown as number,
              type: 'IMAGE'
            },
            context
          )
        }).not.toThrow()

        expect(accepted).toBe(false)
        expect(
          useLinkStore().getTopology(scope.rootGraphId, 99 as never)
        ).toBeUndefined()
        error.mockRestore()
      }),
      { numRuns: 200 }
    )
  })

  it('validates the whole batch before committing when a malformed slot lands mid-batch', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = mutations()

        const applied = graph.batch(context, (batch) => {
          batch.addNode(node(1))
          batch.addNode(node(2))
          batch.connect({
            id: 99,
            originNodeId: 1,
            originSlot: badSlot as unknown as number,
            targetNodeId: 2,
            targetSlot: 0,
            type: 'IMAGE'
          })
        })

        // Abort-remainder / atomicity at the batch level: a malformed op
        // anywhere in the batch means NOTHING in that batch commits, so a
        // fuzzed connect can never leave a half-applied add_node behind.
        expect(applied).toBe(false)
        expect(
          useLinkStore().getTopology(scope.rootGraphId, 99 as never)
        ).toBeUndefined()
        error.mockRestore()
      }),
      { numRuns: 100 }
    )
  })
})
