import { createTestingPinia } from '@pinia/testing'
import * as fc from 'fast-check'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import type { SemanticLinkPayload } from './graphMutations'
import { createGraphMutations } from './graphMutations'

const SLOT_REJECTION = 'connect requires non-negative integer ids and slots'
const FUZZ_SEED = 16_695

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
  const value: SemanticLinkPayload = {
    id: 99,
    originNodeId: 1,
    originSlot: 0,
    targetNodeId: 2,
    targetSlot: 0,
    type: 'IMAGE'
  }
  Reflect.set(value, 'originSlot', originSlot)
  Reflect.set(value, 'targetSlot', targetSlot)
  return value
}

function expectSlotRejection(
  error: ReturnType<typeof vi.spyOn>,
  accepted: boolean | undefined
) {
  expect(accepted).toBe(false)
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SLOT_REJECTION))
  expect(
    useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
  ).toBeUndefined()
}

function expectSeededNodesUnchanged() {
  const nodes = useNodeDataStore()
  expect(
    nodes.getNode(scope.rootGraphId, toNodeId(1))?.outputs[0].links
  ).toEqual([])
  expect(
    nodes.getNode(scope.rootGraphId, toNodeId(2))?.inputs[0].link
  ).toBeNull()
}

describe('QA-12: graphMutations.connect slot fuzz (op-ingestion boundary)', () => {
  it('accepts the well-formed control so rejections below are slot-caused', () => {
    const graph = freshGraph()
    seedNodes(graph)

    expect(graph.connect(link(0, 0), context)).toBe(true)
    expect(
      useLinkStore().getTopology(scope.rootGraphId, toLinkId(99))
    ).toBeDefined()
  })

  it('rejects malformed from_slot values gracefully, never throws, never mutates the store', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        error.mockClear()
        const graph = freshGraph()
        seedNodes(graph)

        const accepted = graph.connect(link(badSlot, 0), context)

        expectSlotRejection(error, accepted)
        expectSeededNodesUnchanged()
      }),
      { seed: FUZZ_SEED, numRuns: 200 }
    )
  })

  it('rejects malformed to_slot values gracefully, never throws, never mutates the store', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        error.mockClear()
        const graph = freshGraph()
        seedNodes(graph)

        const accepted = graph.connect(link(0, badSlot), context)

        expectSlotRejection(error, accepted)
        expectSeededNodesUnchanged()
      }),
      { seed: FUZZ_SEED, numRuns: 200 }
    )
  })

  it('validates the whole batch before committing when a malformed slot lands mid-batch', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    fc.assert(
      fc.property(arbMalformedSlot, (badSlot) => {
        error.mockClear()
        const graph = freshGraph()

        const applied = graph.batch(context, (batch) => {
          batch.addNode(node(1))
          batch.addNode(node(2))
          batch.connect(link(badSlot, 0))
        })

        expectSlotRejection(error, applied)
        const nodes = useNodeDataStore()
        expect(nodes.getNode(scope.rootGraphId, toNodeId(1))).toBeUndefined()
        expect(nodes.getNode(scope.rootGraphId, toNodeId(2))).toBeUndefined()
      }),
      { seed: FUZZ_SEED, numRuns: 100 }
    )
  })
})
