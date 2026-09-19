import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutChange } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import {
  attachNodeLayout,
  detachGraphLayouts,
  detachNodeLayout,
  refreshNodeGeometry,
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

  it('carries the direct owner graph on interior node create and delete', async () => {
    const root = new LGraph()
    const interiorId: UUID = '00000000-0000-4000-8000-000000000001'
    const interior = {
      id: interiorId,
      rootGraph: root
    }
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
        ownerGraphId: interior.id,
        nodeId: node.id
      },
      {
        type: 'deleteNode',
        graphId: root.id,
        ownerGraphId: interior.id,
        nodeId: node.id
      }
    ])
  })

  it('carries the direct owner graph when a released subgraph is bulk-detached', async () => {
    const root = new LGraph()
    const interiorId: UUID = '00000000-0000-4000-8000-000000000001'
    const interior = {
      id: interiorId,
      rootGraph: root
    }
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
        ownerGraphId: interior.id,
        nodeId: node.id
      }
    ])
  })
})

// PM-1304 / PM-1312: Flux2ImageNode (and any autogrow-widget node) can only be
// resized larger, never smaller, once its content has required more height.
// `refreshNodeGeometry` computes the rendered size as
// `Math.max(explicitSize, contentSize)`, a floor that never decreases even
// when the user explicitly drags the node smaller. Once fixed, the explicit
// size the user set via drag should win over a stale, larger content size.
describe('refreshNodeGeometry non-decreasing content-size floor (PM-1304)', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function nodeFor(graph: LGraph, id: string): LGraphNode {
    const node = new LGraphNode(id)
    node.id = toNodeId(id)
    node.graph = graph
    return node
  }

  it.fails('lets an explicit resize shrink the node below a previously reported (now stale) content size', () => {
    const graph = new LGraph()
    const node = nodeFor(graph, 'flux-image-node')
    attachNodeLayout(graph, node)

    // Node starts at a small explicit size.
    setNodeSize(node, [220, 100])
    expect(refreshNodeGeometry(node)).toEqual([220, 100])

    // An autogrow widget (e.g. a multiline prompt) reports content that
    // needs more height than the explicit size, so the rendered size
    // grows to fit it. This part is correct behavior.
    layoutStore.reportContentSize(graph.id, node.id, {
      width: 220,
      height: 400
    })
    expect(refreshNodeGeometry(node)).toEqual([220, 400])

    // The user now drags the resize handle to shrink the node back down.
    // `setNodeSize` is exactly what the resize-drag interaction calls.
    setNodeSize(node, [220, 120])

    // Bug: the rendered size stays pinned to the stale content-size floor
    // instead of honoring the user's explicit smaller size.
    expect(refreshNodeGeometry(node)).toEqual([220, 120])
  })
})
