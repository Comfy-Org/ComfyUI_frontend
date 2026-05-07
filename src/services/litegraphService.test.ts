import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.hoisted(() => vi.fn())
const mockDeselectAll = vi.hoisted(() => vi.fn())
const mockGraphAdd = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined, graph: null },
  ComfyApp: class {}
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => ({
    canvas: { select: mockSelect, deselectAll: mockDeselectAll }
  }))
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({ activeSubgraph: null }))
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: vi.fn(() => ({ typePrefix: 'SubgraphBlueprint.' }))
}))

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { nextTick } from 'vue'

describe('useLitegraphService().getCanvasCenter', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns origin when canvas is not yet initialised', () => {
    Reflect.set(app, 'canvas', undefined)

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns origin when canvas exists but ds.visible_area is missing', () => {
    Reflect.set(app, 'canvas', { ds: {} })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it('returns the visible-area centre once the canvas is ready', () => {
    Reflect.set(app, 'canvas', {
      ds: { visible_area: [10, 20, 200, 100] }
    })

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([110, 70])
  })
})

describe('useLitegraphService().addNodeOnGraph', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockSelect.mockReset()
    mockDeselectAll.mockReset()
    mockGraphAdd.mockReset()
    Reflect.set(app, 'canvas', undefined)
    Reflect.set(app, 'graph', { add: mockGraphAdd })
  })

  it('selects the node after placing it on the graph', async () => {
    const fakeNode = { id: 1, flags: {} }
    vi.spyOn(LiteGraph, 'createNode').mockReturnValue(
      fakeNode as unknown as LGraphNode
    )
    const nodeDef = {
      name: 'TestNode',
      display_name: 'Test Node'
    } as unknown as ComfyNodeDefV1

    useLitegraphService().addNodeOnGraph(nodeDef, { pos: [0, 0] })
    await nextTick()

    expect(mockDeselectAll).toHaveBeenCalledOnce()
    expect(mockSelect).toHaveBeenCalledOnce()
    expect(mockSelect).toHaveBeenCalledWith(fakeNode)
  })

  it('does not select the node when placing in ghost mode', async () => {
    const fakeNode = { id: 1, flags: {} }
    vi.spyOn(LiteGraph, 'createNode').mockReturnValue(
      fakeNode as unknown as LGraphNode
    )
    const nodeDef = {
      name: 'TestNode',
      display_name: 'Test Node'
    } as unknown as ComfyNodeDefV1

    useLitegraphService().addNodeOnGraph(
      nodeDef,
      { pos: [0, 0] },
      { ghost: true }
    )
    await nextTick()

    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockDeselectAll).not.toHaveBeenCalled()
  })
})
