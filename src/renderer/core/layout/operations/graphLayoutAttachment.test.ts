import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutChange } from '@/renderer/core/layout/types'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  attachNodeLayout,
  detachGraphLayouts,
  detachNodeLayout,
  readNodeRenderingSize,
  setNodePosition,
  setNodeSize
} from './graphLayoutAttachment'

describe('node layout attachment ownership', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function nodeFor(graph: LGraph, id: string): LGraphNode {
    const node = new LGraphNode(id)
    node.id = toNodeId(id)
    node.graph = graph
    return node
  }

  it('keeps an adopted layout when the stale instance detaches', () => {
    const graph = new LGraph()
    const oldNode = nodeFor(graph, 'shared')
    const replacement = nodeFor(graph, 'shared')
    attachNodeLayout(graph, oldNode)

    attachNodeLayout(graph, replacement)
    detachNodeLayout(oldNode)
    setNodePosition(replacement, [40, 50])

    expect(
      layoutStore.getNodeLayout(graph.id, replacement.id)?.position
    ).toEqual({ x: 40, y: 50 })
  })

  it('supports detach before attaching the replacement', () => {
    const graph = new LGraph()
    const oldNode = nodeFor(graph, 'shared')
    const replacement = nodeFor(graph, 'shared')
    attachNodeLayout(graph, oldNode)

    detachNodeLayout(oldNode)
    attachNodeLayout(graph, replacement)
    setNodePosition(replacement, [60, 70])

    expect(
      layoutStore.getNodeLayout(graph.id, replacement.id)?.position
    ).toEqual({ x: 60, y: 70 })
  })

  it('scopes interior node create and delete to the root graph', async () => {
    const root = new LGraph()
    const interior = { rootGraph: root }
    const node = nodeFor(root, 'interior-node')
    const changes: LayoutChange[] = []
    const detach = layoutStore.onChange((change) => changes.push(change))

    attachNodeLayout(interior, node)
    detachNodeLayout(node)
    await Promise.resolve()
    detach()

    expect(changes.map(({ operation }) => operation)).toMatchObject([
      {
        type: 'createNode',
        graphId: root.id,
        nodeId: node.id
      },
      {
        type: 'deleteNode',
        graphId: root.id,
        nodeId: node.id
      }
    ])
  })

  it('scopes a bulk-detached interior node delete to the root graph', async () => {
    const root = new LGraph()
    const interior = { rootGraph: root }
    const node = nodeFor(root, 'interior-node')
    attachNodeLayout(interior, node)

    const changes: LayoutChange[] = []
    const detach = layoutStore.onChange((change) => changes.push(change))
    detachGraphLayouts([
      {
        _nodes: [node],
        _groups: [],
        _subgraphs: new Map(),
        reroutes: new Map()
      }
    ])
    await Promise.resolve()
    detach()

    expect(changes.map(({ operation }) => operation)).toMatchObject([
      {
        type: 'deleteNode',
        graphId: root.id,
        nodeId: node.id
      }
    ])
  })
})

describe('requested and measured dimensions', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function nodeFor(graph: LGraph, id: string): LGraphNode {
    const node = new LGraphNode(id)
    node.id = toNodeId(id)
    node.graph = graph
    return node
  }

  it('lets the rendered size shrink when the view reports the smaller dimensions', () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'flux-image-node')
    attachNodeLayout(graph, node)

    setNodeSize(node, [220, 100])
    expect(readNodeRenderingSize(node, { width: 220, height: 400 })).toEqual([
      220, 400
    ])
    setNodeSize(node, [220, 120])
    expect(readNodeRenderingSize(node, { width: 220, height: 120 })).toEqual([
      220, 120
    ])
  })

  it('keeps a subgraph IO panel measurement through an explicit resize', () => {
    const { inputNode } = createTestSubgraph()
    const graphId = inputNode.subgraph.id
    layoutStore.reportContentSize(graphId, inputNode.id, {
      width: 90,
      height: 240
    })

    setNodeSize(inputNode, [70, 100])

    expect(layoutStore.contentSizeOf(graphId, inputNode.id)).toEqual({
      width: 90,
      height: 240
    })
  })
})
