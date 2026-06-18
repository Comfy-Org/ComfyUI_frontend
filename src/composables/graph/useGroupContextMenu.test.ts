import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGroupContextMenu } from '@/composables/graph/useGroupContextMenu'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

const {
  mockShowNodeOptions,
  mockUpdateSelectedItems,
  mockQueryRerouteAtPoint
} = vi.hoisted(() => ({
  mockShowNodeOptions: vi.fn(),
  mockUpdateSelectedItems: vi.fn(),
  mockQueryRerouteAtPoint: vi.fn<() => unknown>(() => null)
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  showNodeOptions: mockShowNodeOptions
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ updateSelectedItems: mockUpdateSelectedItems })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: { queryRerouteAtPoint: mockQueryRerouteAtPoint }
}))

interface StubCanvas {
  graph: { getGroupOnPos: ReturnType<typeof vi.fn> }
  deselectAll: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
}

describe('useGroupContextMenu', () => {
  const group = { id: 1 }
  const event = { canvasX: 10, canvasY: 20 }
  let realProcessContextMenu: typeof LGraphCanvas.prototype.processContextMenu
  let originalSpy: ReturnType<typeof vi.fn>
  let stubCanvas: StubCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryRerouteAtPoint.mockReturnValue(null)
    LiteGraph.vueNodesMode = true

    realProcessContextMenu = LGraphCanvas.prototype.processContextMenu
    originalSpy = vi.fn()
    LGraphCanvas.prototype.processContextMenu = originalSpy as never

    useGroupContextMenu()

    stubCanvas = {
      graph: { getGroupOnPos: vi.fn(() => group) },
      deselectAll: vi.fn(),
      select: vi.fn()
    }
  })

  afterEach(() => {
    LGraphCanvas.prototype.processContextMenu = realProcessContextMenu
    LiteGraph.vueNodesMode = false
  })

  function invoke(node: unknown) {
    LGraphCanvas.prototype.processContextMenu.call(
      stubCanvas as never,
      node as never,
      event as never
    )
  }

  it('opens the Vue menu for a group right-click in Nodes 2.0 mode', () => {
    invoke(undefined)

    expect(stubCanvas.deselectAll).toHaveBeenCalledOnce()
    expect(stubCanvas.select).toHaveBeenCalledWith(group)
    expect(mockUpdateSelectedItems).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(originalSpy).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when a node is under the cursor', () => {
    invoke({ id: 'n1' })

    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
    expect(stubCanvas.select).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu in legacy (non-Nodes 2.0) mode', () => {
    LiteGraph.vueNodesMode = false

    invoke(undefined)

    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
    expect(stubCanvas.select).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when no group is under the cursor', () => {
    stubCanvas.graph.getGroupOnPos.mockReturnValue(undefined)

    invoke(undefined)

    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('keeps the legacy menu when a reroute is under the cursor inside a group', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 5 })

    invoke(undefined)

    expect(stubCanvas.graph.getGroupOnPos).not.toHaveBeenCalled()
    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('preserves selection but still opens the menu when the group is already selected', () => {
    stubCanvas.graph.getGroupOnPos.mockReturnValue({ id: 1, selected: true })

    invoke(undefined)

    expect(stubCanvas.deselectAll).not.toHaveBeenCalled()
    expect(stubCanvas.select).not.toHaveBeenCalled()
    expect(mockUpdateSelectedItems).not.toHaveBeenCalled()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(originalSpy).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when the canvas has no graph', () => {
    const graphlessCanvas = { deselectAll: vi.fn(), select: vi.fn() }

    LGraphCanvas.prototype.processContextMenu.call(
      graphlessCanvas as never,
      undefined as never,
      event as never
    )

    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })
})
