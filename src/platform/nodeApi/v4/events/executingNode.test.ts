import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useExecutionStore } from '@/stores/executionStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function documentWithSubgraph() {
  const root = new LGraph()
  const outer = new LGraphNode('Outer')
  root.add(outer)
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  const placed = createTestSubgraphNode(subgraph, { parentGraph: root })
  root.add(placed)
  const inner = new LGraphNode('Inner')
  subgraph.add(inner)
  let onScreen: LGraph = root
  const api = createComfyApi({ getGraph: () => onScreen })
  return {
    root,
    outer,
    subgraph,
    placed,
    inner,
    show: (graph: LGraph) => {
      onScreen = graph
    },
    ...api
  }
}

function runNode(executionId: string | undefined) {
  useExecutionStore().nodeProgressStates = executionId
    ? {
        [executionId]: {
          value: 0,
          max: 1,
          state: 'running',
          node_id: executionId,
          display_node_id: executionId,
          prompt_id: 'job'
        }
      }
    : {}
}

describe('executionNode', () => {
  it('names the node an execution id points at, in its own graph', () => {
    const { outer, placed, inner, subgraph, comfy, show } =
      documentWithSubgraph()
    show(subgraph)

    expect(comfy.executionNode(String(outer.id))?.getTitle()).toBe('Outer')
    const nested = comfy.executionNode(`${placed.id}:${inner.id}`)
    expect(nested?.graphId).toBe(subgraph.id)
    expect(nested).toBe(comfy.graph.node(String(inner.id)))
  })

  it('is undefined for an id with no node, or before there is a graph', () => {
    const { comfy } = documentWithSubgraph()
    const empty = createComfyApi({ getGraph: () => null }).comfy

    expect(comfy.executionNode('999')).toBeUndefined()
    expect(comfy.executionNode('')).toBeUndefined()
    expect(empty.executionNode('1')).toBeUndefined()
  })

  it('refuses an id that is not a string', () => {
    const { comfy } = documentWithSubgraph()

    expect(() => Reflect.apply(comfy.executionNode, comfy, [1])).toThrow(
      'executionNode needs an execution id, not 1.'
    )
  })
})

describe('executingNode', () => {
  it('is the node the backend runs, and undefined between runs', () => {
    const { placed, inner, comfy } = documentWithSubgraph()

    expect(comfy.executingNode()).toBeUndefined()

    runNode(`${placed.id}:${inner.id}`)

    expect(comfy.executingNode()?.getTitle()).toBe('Inner')
  })

  it('tells a listener each time the running node changes, and when it stops', async () => {
    const { outer, inner, placed, comfy } = documentWithSubgraph()
    const seen: (string | undefined)[] = []
    comfy.onExecutingNodeChanged((node) => seen.push(node?.getTitle()))

    runNode(String(outer.id))
    await nextTick()
    runNode(`${placed.id}:${inner.id}`)
    await nextTick()
    runNode(undefined)
    await nextTick()

    expect(seen).toEqual(['Outer', 'Inner', undefined])
  })

  it('stops following execution when its last listener leaves', async () => {
    const { outer, comfy } = documentWithSubgraph()
    const changed = vi.fn()
    const stop = comfy.onExecutingNodeChanged(changed)

    stop()
    stop()
    runNode(String(outer.id))
    await nextTick()

    expect(changed).not.toHaveBeenCalled()
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = documentWithSubgraph()

    expect(() =>
      Reflect.apply(comfy.onExecutingNodeChanged, comfy, [{}])
    ).toThrow(TypeError)
  })
})
