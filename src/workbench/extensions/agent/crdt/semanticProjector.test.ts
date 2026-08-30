import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

import { NODES_KEY, WIDGETS_KEY } from './docSchema'
import type { GraphMutator, MutationBatch } from './graphMutations'
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

  it('re-materializes the seed after reset (workflow switch)', () => {
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

  it('keeps the pre-batch snapshot when applyBatch throws, so a retry repairs the canvas', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', 'LoadImage', [0, 0])
    const mutator = new FakeGraphMutator()
    let failNext = true
    const failingMutator = {
      applyBatch(batch: MutationBatch): void {
        if (failNext) {
          failNext = false
          throw new Error('node construction failed mid-batch')
        }
        mutator.applyBatch(batch)
      }
    }
    const projector = new SemanticProjector(failingMutator)

    expect(() => projector.project(doc)).toThrow()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_semantic_projection_failure'
    })

    // The snapshot was NOT advanced past the failed batch: the retry
    // re-derives the same delta instead of diffing to zero mutations and
    // stranding the canvas.
    const retried = projector.project(doc)
    expect(retried).toBe(1)
    expect(mutator.batches).toHaveLength(1)
    expect(mutator.batches[0].mutations[0]).toMatchObject({ kind: 'add_node' })

    // And a repaired projector converges: nothing further to apply.
    expect(projector.project(doc)).toBe(0)
  })
})
