import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LGraphNode } from '@comfyorg/litegraph/litegraph'
import { app } from '@/scripts/app'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@comfyorg/litegraph/utils/graphTraversalUtil'

import { useWidgetHostNode } from './useWidgetHostNode'

vi.mock(import('@/scripts/app'))

vi.mock(import('@comfyorg/litegraph/utils/graphTraversalUtil'))

const locatorId = createNodeLocatorId(null, 7)
const locatedNode = new LGraphNode('located')
const canvasNode = new LGraphNode('canvas')

describe('useWidgetHostNode', () => {
  beforeEach(() => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(null)
    vi.spyOn(app.canvas.graph!, 'getNodeById').mockReturnValue(canvasNode)
  })

  it('prefers the node found by its locator id', () => {
    vi.mocked(getNodeByLocatorId).mockReturnValue(locatedNode)

    const node = useWidgetHostNode(locatorId, toNodeId(7))

    expect(node.value).toBe(locatedNode)
  })

  it('falls back to the canvas graph by node id', () => {
    const node = useWidgetHostNode(undefined, toNodeId(7))

    expect(node.value).toBe(canvasNode)
    expect(app.canvas.graph!.getNodeById).toHaveBeenCalledWith(toNodeId(7))
  })

  it('falls back to the canvas graph when the locator id finds no node', () => {
    const node = useWidgetHostNode(locatorId, toNodeId(7))

    expect(node.value).toBe(canvasNode)
    expect(getNodeByLocatorId).toHaveBeenCalledWith(app.rootGraph, locatorId)
  })

  it('follows a changing locator id', () => {
    const changingLocatorId = ref<NodeLocatorId | undefined>()
    const node = useWidgetHostNode(changingLocatorId, toNodeId(7))
    expect(node.value).toBe(canvasNode)

    vi.mocked(getNodeByLocatorId).mockReturnValue(locatedNode)
    changingLocatorId.value = locatorId

    expect(node.value).toBe(locatedNode)
  })
})
