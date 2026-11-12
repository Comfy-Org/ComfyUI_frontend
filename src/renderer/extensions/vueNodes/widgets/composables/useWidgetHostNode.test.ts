import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, ref } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import { useWidgetHostNode } from './useWidgetHostNode'

vi.mock(import('@/scripts/app'))

vi.mock(import('@/utils/graphTraversalUtil'))

const locatorId = createNodeLocatorId(null, 7)
const locatedNode = new LGraphNode('located')
const canvasNode = new LGraphNode('canvas')

function scopedOwner(...args: Parameters<typeof useWidgetHostNode>) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const owner = scope.run(() => useWidgetHostNode(...args))
  assert.exists(owner)
  return owner
}

describe('useWidgetHostNode', () => {
  beforeEach(() => {
    const graph = app.canvas.graph
    assert.exists(graph)
    useCanvasStore().currentGraph = graph
    vi.mocked(getNodeByLocatorId).mockReturnValue(null)
    vi.spyOn(graph, 'getNodeById').mockReturnValue(canvasNode)
  })

  it('prefers the node found by its locator id', () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(locatedNode)

    const node = scopedOwner(locatorId, toNodeId(7))

    expect(node.value).toBe(locatedNode)
  })

  it('falls back to the canvas graph by node id', () => {
    const node = scopedOwner(undefined, toNodeId(7))

    expect(node.value).toBe(canvasNode)
    expect(useCanvasStore().currentGraph?.getNodeById).toHaveBeenCalledWith(
      toNodeId(7)
    )
  })

  it('falls back to the canvas graph when the locator id finds no node', () => {
    const node = scopedOwner(locatorId, toNodeId(7))

    expect(node.value).toBe(canvasNode)
    expect(getNodeByLocatorId).toHaveBeenCalledWith(app.rootGraph, locatorId)
  })

  it('follows a changing locator id', () => {
    const changingLocatorId = ref<NodeLocatorId | undefined>()
    const node = scopedOwner(changingLocatorId, toNodeId(7))
    expect(node.value).toBe(canvasNode)

    vi.mocked(getNodeByLocatorId).mockReturnValue(locatedNode)
    changingLocatorId.value = locatorId

    expect(node.value).toBe(locatedNode)
  })
})
