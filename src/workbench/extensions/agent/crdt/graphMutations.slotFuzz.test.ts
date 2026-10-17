import { fromAny } from '@total-typescript/shoehorn'
import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import {
  OP_INGESTION_FUZZ_CONFIG,
  arbMalformedSlot
} from '@/testing/opIngestionFuzzConfig'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { createGraphMutations } from './graphMutations'

const SLOT_REJECTION = 'connect requires non-negative integer ids and slots'

/**
 * Each property run needs a store with no residue from the previous one, and
 * the global testing Pinia is installed once per `it`, not once per run.
 * Rather than standing up a second Pinia, every run gets its own graph id, so
 * the shared stores partition the runs instead of accumulating them.
 */
let runCount = 0
function freshScope() {
  const id = `root-${(runCount += 1)}`
  return {
    rootGraphId: toRootGraphId(id),
    owningGraphId: toOwningGraphId(id)
  }
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

function freshGraph() {
  const scope = freshScope()
  const mutations = createGraphMutations({
    getScope: () => scope,
    layout: { createNode: vi.fn(), deleteNodes: vi.fn() },
    // Slot validation runs before anything consults placement, so an
    // always-null port keeps this suite on the boundary it is fuzzing. A
    // measuring stub here would only assert `graphMutations.test.ts`'s subject.
    placement: { nodeBounds: () => null, viewportBounds: () => null }
  })
  return { mutations, scope }
}

type Graph = ReturnType<typeof freshGraph>['mutations']

function seedNodes(graph: Graph) {
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
    originSlot: fromAny<number, unknown>(originSlot),
    targetNodeId: 2,
    targetSlot: fromAny<number, unknown>(targetSlot),
    type: 'IMAGE'
  }
}

function expectSlotRejection(
  error: ReturnType<typeof vi.spyOn>,
  accepted: boolean | undefined,
  scope: ReturnType<typeof freshScope>
) {
  expect(accepted).toBe(false)
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SLOT_REJECTION))
  expect(
    useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
  ).toBeUndefined()
}

describe('QA-12: graphMutations.connect slot fuzz (op-ingestion boundary)', () => {
  it('accepts the well-formed control so rejections below are slot-caused', () => {
    const { mutations: graph, scope } = freshGraph()
    seedNodes(graph)

    expect(graph.connect(link(0, 0), context)).toBe(true)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
    ).toBeDefined()
  })

  it('rejects malformed from_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
          const { mutations: graph, scope } = freshGraph()
          seedNodes(graph)

          let accepted: boolean | undefined
          expect(() => {
            accepted = graph.connect(link(badSlot, 0), context)
          }).not.toThrow()

          expectSlotRejection(error, accepted, scope)
        } finally {
          error.mockRestore()
        }
      }),
      OP_INGESTION_FUZZ_CONFIG
    )
  })

  it('rejects malformed to_slot values gracefully, never throws, never mutates the store', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
          const { mutations: graph, scope } = freshGraph()
          seedNodes(graph)

          let accepted: boolean | undefined
          expect(() => {
            accepted = graph.connect(link(0, badSlot), context)
          }).not.toThrow()

          expectSlotRejection(error, accepted, scope)
        } finally {
          error.mockRestore()
        }
      }),
      OP_INGESTION_FUZZ_CONFIG
    )
  })

  it('validates the whole batch before committing when a malformed slot lands mid-batch', () => {
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
          const { mutations: graph, scope } = freshGraph()

          const applied = graph.batch(context, (batch) => {
            batch.addNode(node(1))
            batch.addNode(node(2))
            batch.connect(link(badSlot, 0))
          })

          expectSlotRejection(error, applied, scope)
          const nodes = useNodeDataStore()
          expect(nodes.getNode(scope.rootGraphId, toNodeId(1))).toBeUndefined()
          expect(nodes.getNode(scope.rootGraphId, toNodeId(2))).toBeUndefined()
        } finally {
          error.mockRestore()
        }
      }),
      OP_INGESTION_FUZZ_CONFIG
    )
  })
})
