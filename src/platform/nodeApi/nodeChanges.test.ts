import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from './comfyApi'
import { ComfyApiError } from './errors'
import { provideNodeChangeSource, resetNodeChangeSource } from './nodeChanges'
import type { NodeChangeScope, TrackedProperty } from './nodeChanges'

interface Change {
  graphId: string
  nodeId: string
  property: TrackedProperty
  from: unknown
  to: unknown
}

/** Stands in for the app-layer bridge. */
function sourceEmitting() {
  let emit: ((change: Change) => void) | undefined
  const scopes: NodeChangeScope[] = []
  const unsubscribe = vi.fn()
  provideNodeChangeSource((scope, onChange) => {
    scopes.push(scope)
    emit = onChange
    return unsubscribe
  })
  return {
    emit: (change: Change) => emit?.(change),
    scopes,
    unsubscribe
  }
}

function apiWithNode() {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const graph = new LGraph()
  const node = new LGraphNode('Sampler')
  graph.add(node)
  return { graph, node, comfy: createComfyApi(() => graph) }
}

/**
 * A root node and a subgraph node, in one document.
 *
 * These carried the same id until ECS, because a subgraph authored elsewhere
 * brings its own. `nodeDataStore` now buckets registrations by root graph id,
 * so `add()` re-mints on collision and one document cannot hold a duplicate.
 *
 * The routing below still has to name the graph a change came from: a node id
 * on its own is resolved against the graph on screen, which is not necessarily
 * the graph that changed.
 */
function documentWithTwoGraphs() {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const root = new LGraph()
  const top = new LGraphNode('Top', 'TestNode')
  root.add(top)

  const subgraph = createTestSubgraph({ rootGraph: root, name: 'Upscale' })
  root.subgraphs.set(subgraph.id, subgraph)
  const inner = new LGraphNode('Inner', 'TestNode')
  subgraph.add(inner)

  return { root, subgraph, top, inner, comfy: createComfyApi(() => root) }
}

describe('onNodeChanged', () => {
  afterEach(resetNodeChangeSource)

  it('reports a change on a node the pack does not own', () => {
    // rgthree's relay exists to watch other nodes' modes; it polls every 500ms
    // and traps `mode` with defineProperty because nothing reports it.
    const source = sourceEmitting()
    const { graph, node, comfy } = apiWithNode()
    const seen: unknown[] = []
    comfy.onNodeChanged((e) => seen.push(e))

    source.emit({
      graphId: graph.id,
      nodeId: String(node.id),
      property: 'mode',
      from: 0,
      to: 2
    })

    expect(seen).toEqual([
      {
        node: expect.objectContaining({ id: String(node.id) }),
        graphId: graph.id,
        property: 'mode',
        from: 0,
        to: 2
      }
    ])
  })

  it('drops a change for a node that has since gone', () => {
    const source = sourceEmitting()
    const { graph, comfy } = apiWithNode()
    const listener = vi.fn()
    comfy.onNodeChanged(listener)

    source.emit({
      graphId: graph.id,
      nodeId: '999',
      property: 'mode',
      from: 0,
      to: 2
    })

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops when unsubscribed', () => {
    const source = sourceEmitting()
    const { comfy } = apiWithNode()

    comfy.onNodeChanged(vi.fn())()

    expect(source.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('fails loudly when the host wired no source', () => {
    // A capability that accepts listeners and never calls them is how
    // onPreview shipped broken for weeks.
    resetNodeChangeSource()
    const { comfy } = apiWithNode()

    expect(() => comfy.onNodeChanged(vi.fn())).toThrow(ComfyApiError)
  })

  it('asks the host for the graph on screen unless told otherwise', () => {
    const source = sourceEmitting()
    const { comfy } = apiWithNode()

    comfy.onNodeChanged(vi.fn())
    comfy.onNodeChanged(vi.fn(), { scope: 'document' })

    expect(source.scopes).toEqual(['visible', 'document'])
  })

  it('resolves the node in the graph the change came from', () => {
    // The graph on screen is the root, and it does not hold this node at all.
    // Resolving there would hand the pack nothing, or — once ids are reused
    // across documents — a completely different node.
    const source = sourceEmitting()
    const { subgraph, inner, comfy } = documentWithTwoGraphs()
    const seen: string[] = []
    comfy.onNodeChanged((e) => seen.push(e.node.getTitle()), {
      scope: 'document'
    })

    source.emit({
      graphId: subgraph.id,
      nodeId: String(inner.id),
      property: 'title',
      from: 'Inner',
      to: 'Inner'
    })

    expect(seen).toEqual(['Inner'])
  })

  it('resolves a root-graph change while the user is inside a subgraph', () => {
    const source = sourceEmitting()
    const { root, subgraph, top } = documentWithTwoGraphs()
    const comfy = createComfyApi(() => subgraph)
    const seen: string[] = []
    comfy.onNodeChanged((e) => seen.push(e.node.getTitle()), {
      scope: 'document'
    })

    source.emit({
      graphId: root.id,
      nodeId: String(top.id),
      property: 'title',
      from: 'Top',
      to: 'Top'
    })

    expect(seen).toEqual(['Top'])
  })
})
