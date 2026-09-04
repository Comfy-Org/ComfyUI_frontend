/**
 * QA-12: fuzz the FE op-ingestion boundary with malformed `connect` payloads
 * (the from_slot-class gaps: negatives, floats, NaN, wrong types).
 *
 * `createGraphMutations(...).connect()` is where an incoming remote `connect`
 * op (already read off the shared Yjs doc by `ecsFollowerAdapter`'s
 * `readSemanticLink`) is committed into the app's node/link stores. It is the
 * last gate before slot values become store state, and until this test its
 * `'connect requires non-negative integer ids and slots'` rejection branch
 * had zero coverage.
 *
 * `readSemanticLink` coerces with `Number(...)` before its `Number.isInteger`
 * guard, so a negative integer survives it as a well-typed `number` and this
 * boundary is the only thing that catches it. Wrong-typed slots (`null`,
 * booleans, empty strings, small arrays) do NOT reach here at all: `Number()`
 * repairs them into in-range integers upstream. That coercion is the
 * adapter's problem and is out of scope for this file; the fuzz below covers
 * what does arrive.
 *
 * Assert: `connect()` never throws for any malformed slot value, always
 * returns `false` via the slot-validation branch (rejection here is a
 * boolean plus a logged reason, never a raw TypeError escaping), and never
 * mutates the stores on rejection. A well-formed control shows the rejection
 * is caused by the slot and not by the fixture.
 */
import { createTestingPinia } from '@pinia/testing'
import * as fc from 'fast-check'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import { createGraphMutations } from './graphMutations'

const SLOT_REJECTION = 'connect requires non-negative integer ids and slots'

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
  fc.integer({ min: -1000, max: -1 }),
  fc
    .double({ noNaN: false, noDefaultInfinity: false })
    .filter((n) => !Number.isInteger(n)),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.array(fc.integer(), { maxLength: 3 })
)

function freshGraph() {
  setActivePinia(createTestingPinia({ stubActions: false }))
  return createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() }
  })
}

function seedNodes(graph: ReturnType<typeof freshGraph>) {
  const seeded = graph.batch(context, (batch) => {
    batch.addNode(node(1))
    batch.addNode(node(2))
  })
  expect(seeded).toBe(true)
}

function link(originSlot: unknown, targetSlot: unknown) {
  return {
    id: 99,
    originNodeId: 1,
    originSlot: originSlot as number,
    targetNodeId: 2,
    targetSlot: targetSlot as number,
    type: 'IMAGE'
  }
}

function expectSlotRejection(
  error: ReturnType<typeof vi.spyOn>,
  accepted: boolean | undefined
) {
  expect(accepted).toBe(false)
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SLOT_REJECTION))
  expect(
    useLinkStore().getTopology(scope.rootGraphId, 99 as never)
  ).toBeUndefined()
}

describe('QA-12: graphMutations.connect slot fuzz (op-ingestion boundary)', () => {
  it('accepts the well-formed control so rejections below are slot-caused', () => {
    const graph = freshGraph()
    seedNodes(graph)

    expect(graph.connect(link(0, 0), context)).toBe(true)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, 99 as never)
    ).toBeDefined()
  })

  it('rejects malformed from_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = freshGraph()
        seedNodes(graph)

        let accepted: boolean | undefined
        expect(() => {
          accepted = graph.connect(link(badSlot, 0), context)
        }).not.toThrow()

        expectSlotRejection(error, accepted)
        error.mockRestore()
      }),
      { numRuns: 200 }
    )
  })

  it('rejects malformed to_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = freshGraph()
        seedNodes(graph)

        let accepted: boolean | undefined
        expect(() => {
          accepted = graph.connect(link(0, badSlot), context)
        }).not.toThrow()

        expectSlotRejection(error, accepted)
        error.mockRestore()
      }),
      { numRuns: 200 }
    )
  })

  it('validates the whole batch before committing when a malformed slot lands mid-batch', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const graph = freshGraph()

        const applied = graph.batch(context, (batch) => {
          batch.addNode(node(1))
          batch.addNode(node(2))
          batch.connect(link(badSlot, 0))
        })

        // A malformed op anywhere in the batch means nothing in that batch
        // commits, so a fuzzed connect can never leave a half-applied
        // add_node behind.
        expectSlotRejection(error, applied)
        const nodes = useNodeDataStore()
        expect(nodes.getNode(scope.rootGraphId, 1 as never)).toBeUndefined()
        expect(nodes.getNode(scope.rootGraphId, 2 as never)).toBeUndefined()
        error.mockRestore()
      }),
      { numRuns: 100 }
    )
  })
})
