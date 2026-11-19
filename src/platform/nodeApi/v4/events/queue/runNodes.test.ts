import { assert, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'

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
  const { comfy, host } = createComfyApi({ getGraph: () => onScreen })
  const queuePrompt = vi.spyOn(app, 'queuePrompt').mockResolvedValue(true)
  const nodeOf = (graph: LGraph, node: LGraphNode) => {
    const handle = comfy.graph.root()
    assert(handle)
    const found =
      graph === root
        ? handle.node(String(node.id))
        : comfy.graph.subgraphs()[0].node(String(node.id))
    assert(found)
    return found
  }
  return {
    root,
    outer,
    subgraph,
    placed,
    inner,
    comfy,
    host,
    queuePrompt,
    nodeOf,
    show: (graph: LGraph) => {
      onScreen = graph
    }
  }
}

describe('queue.run', () => {
  it('queues the whole workflow as Run does, and passes on what the host answers', async () => {
    const { comfy, queuePrompt } = documentWithSubgraph()
    queuePrompt.mockResolvedValue(false)

    await expect(comfy.queue.run()).resolves.toBe(false)
    await expect(comfy.queue.run({})).resolves.toBe(false)

    expect(queuePrompt.mock.calls).toEqual([[0], [0]])
  })

  it('runs a root node while the user is inside a subgraph, and a subgraph node by its path', async () => {
    const {
      root,
      subgraph,
      outer,
      placed,
      inner,
      comfy,
      queuePrompt,
      nodeOf,
      show
    } = documentWithSubgraph()
    const outerHandle = nodeOf(root, outer)
    const innerHandle = nodeOf(subgraph, inner)

    show(subgraph)
    await comfy.queue.run({ nodes: [outerHandle] })
    show(root)
    await comfy.queue.run({ nodes: [innerHandle, outerHandle] })

    expect(queuePrompt.mock.calls).toEqual([
      [0, 1, [String(outer.id)]],
      [0, 1, [`${placed.id}:${inner.id}`, String(outer.id)]]
    ])
  })

  it('resolves false for a node that is gone, without queuing', async () => {
    const { root, outer, comfy, queuePrompt, nodeOf } = documentWithSubgraph()
    const handle = nodeOf(root, outer)
    root.remove(outer)

    await expect(comfy.queue.run({ nodes: [handle] })).resolves.toBe(false)
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('resolves false for a handle from a document since replaced, even where its id is reused', async () => {
    const { root, outer, comfy, host, queuePrompt, nodeOf } =
      documentWithSubgraph()
    const kept = nodeOf(root, outer)

    host.beginDocument()

    expect(comfy.graph.node(String(outer.id))).not.toBe(kept)
    await expect(comfy.queue.run({ nodes: [kept] })).resolves.toBe(false)
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('resolves false for a node in a subgraph that is not placed in the workflow', async () => {
    const { root, placed, subgraph, inner, comfy, queuePrompt, nodeOf } =
      documentWithSubgraph()
    const handle = nodeOf(subgraph, inner)
    root.remove(placed)
    root.subgraphs.set(subgraph.id, subgraph)

    await expect(comfy.queue.run({ nodes: [handle] })).resolves.toBe(false)
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it.for([
    ['options that are not an object', 'everything'],
    ['nodes that are not a list', { nodes: 'all' }],
    ['an empty list of nodes', { nodes: [] }],
    [
      'something that only looks like a handle',
      { nodes: [{ id: '1', graphId: 'x' }] }
    ],
    ['a value that is not a handle', { nodes: [1] }],
    ['null for a handle', { nodes: [null] }]
  ] as const)('refuses %s, without queuing', ([, options]) => {
    const { comfy, queuePrompt } = documentWithSubgraph()

    expect(() =>
      Reflect.apply(comfy.queue.run, comfy.queue, [options])
    ).toThrow(/^queue\.run needs /)
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('refuses a frozen copy of a handle, which the API did not make', () => {
    const { root, outer, comfy, queuePrompt } = documentWithSubgraph()

    expect(() =>
      Reflect.apply(comfy.queue.run, comfy.queue, [
        { nodes: [Object.freeze({ id: outer.id, graphId: root.id })] }
      ])
    ).toThrow('queue.run needs node handles')
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('runs every node it is given from one graph', async () => {
    const { root, outer, comfy, queuePrompt, nodeOf } = documentWithSubgraph()
    const second = new LGraphNode('Second')
    root.add(second)

    await comfy.queue.run({
      nodes: [nodeOf(root, outer), nodeOf(root, second)]
    })

    expect(queuePrompt).toHaveBeenCalledExactlyOnceWith(
      0,
      1,
      expect.arrayContaining([String(outer.id), String(second.id)])
    )
    expect(queuePrompt.mock.calls[0][2]).toHaveLength(2)
  })

  it('refuses a handle another API made', () => {
    const { root, outer, nodeOf } = documentWithSubgraph()
    const handle = nodeOf(root, outer)
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(() => comfy.queue.run({ nodes: [handle] })).toThrow(
      'queue.run needs node handles'
    )
  })
})
