import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { useWidgetHostNode } from './useWidgetHostNode'

vi.mock(import('@/scripts/app'))

function scopedOwner(...args: Parameters<typeof useWidgetHostNode>) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const owner = scope.run(() => useWidgetHostNode(...args))
  assert.exists(owner)
  return owner
}

function showRootGraphWithNodes() {
  const root = app.rootGraph
  const canvasNode = new LGraphNode('canvas')
  const locatedNode = new LGraphNode('located')
  root.add(canvasNode)
  root.add(locatedNode)
  useCanvasStore().currentGraph = root
  return { canvasNode, locatedNode }
}

function showSubgraph() {
  const root = app.rootGraph
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  useCanvasStore().currentGraph = subgraph
  return subgraph
}

describe('useWidgetHostNode', () => {
  it('prefers the node found by its locator id', () => {
    const { canvasNode, locatedNode } = showRootGraphWithNodes()

    const node = scopedOwner(
      canvasNode.id,
      createNodeLocatorId(null, locatedNode.id)
    )

    expect(node.value).toBe(locatedNode)
  })

  it('falls back to the root graph node with the given id', () => {
    const { canvasNode } = showRootGraphWithNodes()

    const node = scopedOwner(canvasNode.id)

    expect(node.value).toBe(canvasNode)
  })

  it('falls back to the node id when the locator id finds no node', () => {
    const { canvasNode } = showRootGraphWithNodes()

    const node = scopedOwner(canvasNode.id, createNodeLocatorId(null, 999))

    expect(node.value).toBe(canvasNode)
  })

  it('finds nothing for an id no node in the root graph has', () => {
    showRootGraphWithNodes()

    const node = scopedOwner(toNodeId(999))

    expect(node.value).toBeUndefined()
  })

  it('finds a root graph node while the canvas shows a subgraph', () => {
    const owner = new LGraphNode('owner')
    app.rootGraph.add(owner)
    showSubgraph()

    const node = scopedOwner(owner.id)

    expect(node.value).toBe(owner)
  })

  it('finds a node inside the subgraph the canvas shows', () => {
    const subgraph = showSubgraph()
    const interior = new LGraphNode('interior')
    subgraph.add(interior)

    const node = scopedOwner(interior.id)

    expect(node.value).toBe(interior)
  })

  it('follows a changing locator id', () => {
    const { canvasNode, locatedNode } = showRootGraphWithNodes()
    const changingLocatorId = ref<NodeLocatorId | undefined>()
    const node = scopedOwner(canvasNode.id, changingLocatorId)
    expect(node.value).toBe(canvasNode)

    changingLocatorId.value = createNodeLocatorId(null, locatedNode.id)

    expect(node.value).toBe(locatedNode)
  })
})
