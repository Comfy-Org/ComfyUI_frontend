import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { NODES_KEY, WIDGETS_KEY } from './docSchema'
import type { GraphMutator, MutationBatch } from './graphMutations'
import { LitegraphMutator } from './litegraphMutator'
import { SemanticProjector } from './semanticProjector'

class FakeGraphMutator implements GraphMutator {
  readonly batches: MutationBatch[] = []
  applyBatch(batch: MutationBatch): void {
    this.batches.push(batch)
  }
}

function setNode(doc: Y.Doc, id: string, type: string, pos: number[]): void {
  const m = new Y.Map<unknown>()
  m.set('type', type)
  m.set('pos', pos)
  m.set(WIDGETS_KEY, new Y.Map<unknown>())
  doc.getMap<Y.Map<unknown>>(NODES_KEY).set(id, m)
}

describe('SemanticProjector', () => {
  it('materializes the seed as add_node on first projection', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', 'LoadImage', [0, 0])
    const mutator = new FakeGraphMutator()

    const count = new SemanticProjector(mutator, { actor: 'tab-1' }).project(
      doc
    )

    expect(count).toBe(1)
    expect(mutator.batches).toHaveLength(1)
    expect(mutator.batches[0]).toMatchObject({
      source: 'agent-remote',
      actor: 'tab-1',
      mutations: [{ kind: 'add_node', node: { id: toNodeId('1') } }]
    })
  })

  it('emits only the delta on subsequent projections and nothing when unchanged', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', 'LoadImage', [0, 0])
    const mutator = new FakeGraphMutator()
    const projector = new SemanticProjector(mutator)

    projector.project(doc)
    setNode(doc, '2', 'SaveImage', [100, 0])
    const secondCount = projector.project(doc)
    const thirdCount = projector.project(doc)

    expect(secondCount).toBe(1)
    expect(mutator.batches[1].mutations).toEqual([
      {
        kind: 'add_node',
        node: {
          id: toNodeId('2'),
          type: 'SaveImage',
          pos: [100, 0],
          widgets: {}
        }
      }
    ])
    expect(thirdCount).toBe(0)
    expect(mutator.batches).toHaveLength(2)
  })

  it('re-materializes the seed after reset (reconnect / workflow switch)', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', 'LoadImage', [0, 0])
    const mutator = new FakeGraphMutator()
    const projector = new SemanticProjector(mutator)

    projector.project(doc)
    projector.reset()
    const afterReset = projector.project(doc)

    expect(afterReset).toBe(1)
    expect(mutator.batches).toHaveLength(2)
  })

  it('R-48 current-risk reproducer: advances the snapshot before an over-ceiling add throws', () => {
    const doc = new Y.Doc()
    for (let id = 1; id <= LiteGraph.MAX_NUMBER_OF_NODES; id++) {
      setNode(doc, String(id), 'LoadImage', [id, 0])
    }

    const graph = new LGraph()
    let activeGraph: LGraph | null = null
    const mutator = new LitegraphMutator({
      getGraph: () => activeGraph,
      createNode: () => new LGraphNode('R-48 ceiling candidate')
    })
    const projector = new SemanticProjector(mutator)

    // Establish an aligned snapshot without painting the initial document; then
    // model the already-rendered canvas at LiteGraph's current admission limit.
    expect(projector.project(doc)).toBe(LiteGraph.MAX_NUMBER_OF_NODES)
    graph._nodes.length = LiteGraph.MAX_NUMBER_OF_NODES
    activeGraph = graph

    const overCeilingId = String(LiteGraph.MAX_NUMBER_OF_NODES + 1)
    setNode(doc, overCeilingId, 'SaveImage', [0, 0])

    // This characterizes the current R-48 hazard, not desired behavior:
    // project() stores `next` before applyBatch() reaches LGraph.add()'s guard.
    expect(() => projector.project(doc)).toThrow(
      'LiteGraph: max number of nodes in a graph reached'
    )
    expect(graph._nodes).toHaveLength(LiteGraph.MAX_NUMBER_OF_NODES)
    expect(graph.getNodeById(toNodeId(overCeilingId))).toBeUndefined()

    // The advanced snapshot makes the unchanged retry look fully projected, so
    // the missing canvas node cannot self-heal without an explicit reset.
    expect(projector.project(doc)).toBe(0)
    expect(graph._nodes).toHaveLength(LiteGraph.MAX_NUMBER_OF_NODES)
    expect(graph.getNodeById(toNodeId(overCeilingId))).toBeUndefined()
  })
})
