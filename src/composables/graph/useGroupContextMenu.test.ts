import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGroupContextMenu } from '@/composables/graph/useGroupContextMenu'
import type {
  CanvasPointerEvent,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

const {
  mockShowNodeOptions,
  mockUpdateSelectedItems,
  mockGetCanvasContextMenuTarget
} = vi.hoisted(() => ({
  mockShowNodeOptions: vi.fn(),
  mockUpdateSelectedItems: vi.fn(),
  mockGetCanvasContextMenuTarget: vi.fn<
    () => { reroute?: unknown; group?: unknown }
  >(() => ({}))
}))

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  showNodeOptions: mockShowNodeOptions
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ updateSelectedItems: mockUpdateSelectedItems })
}))

vi.mock('@/lib/litegraph/src/canvas/getCanvasContextMenuTarget', () => ({
  getCanvasContextMenuTarget: mockGetCanvasContextMenuTarget
}))

interface StubCanvas {
  graph: object
  deselectAll: ReturnType<typeof vi.fn>
  selectedItems: Set<unknown>
  state: { selectionChanged: boolean }
}

describe('useGroupContextMenu', () => {
  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })
  let group: {
    id: number
    selected?: boolean
    recomputeInsideNodes: ReturnType<typeof vi.fn>
  }
  let legacyMenuMock: ReturnType<typeof vi.fn>
  let stubCanvas: StubCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    LiteGraph.vueNodesMode = true
    group = { id: 1, recomputeInsideNodes: vi.fn() }
    mockGetCanvasContextMenuTarget.mockReturnValue({ group })

    legacyMenuMock = vi.fn()
    LGraphCanvas.prototype.processContextMenu = fromAny(legacyMenuMock)

    useGroupContextMenu()

    stubCanvas = {
      graph: {},
      deselectAll: vi.fn(),
      selectedItems: new Set(),
      state: { selectionChanged: false }
    }
    stubCanvas.deselectAll.mockImplementation(() => {
      stubCanvas.selectedItems.clear()
    })
  })

  function invoke(node: LGraphNode | undefined) {
    LGraphCanvas.prototype.processContextMenu.call(
      fromAny(stubCanvas),
      node,
      event
    )
  }

  it('opens the Vue menu and selects only the group in Nodes 2.0 mode', () => {
    invoke(undefined)

    expect(stubCanvas.deselectAll).toHaveBeenCalledOnce()
    expect(group.selected).toBe(true)
    expect(stubCanvas.selectedItems.has(group)).toBe(true)
    expect(stubCanvas.state.selectionChanged).toBe(true)
    expect(group.recomputeInsideNodes).toHaveBeenCalledOnce()
    expect(mockUpdateSelectedItems).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(mockUpdateSelectedItems.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowNodeOptions.mock.invocationCallOrder[0]
    )
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when a node is under the cursor', () => {
    invoke(fromPartial<LGraphNode>({}))

    expect(mockGetCanvasContextMenuTarget).not.toHaveBeenCalled()
    expect(legacyMenuMock).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu in legacy (non-Nodes 2.0) mode', () => {
    LiteGraph.vueNodesMode = false

    invoke(undefined)

    expect(mockGetCanvasContextMenuTarget).not.toHaveBeenCalled()
    expect(legacyMenuMock).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when no group is under the cursor', () => {
    mockGetCanvasContextMenuTarget.mockReturnValue({})

    invoke(undefined)

    expect(legacyMenuMock).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
    expect(stubCanvas.selectedItems.size).toBe(0)
  })

  it('falls through to the legacy menu when the cursor is on a reroute', () => {
    mockGetCanvasContextMenuTarget.mockReturnValue({
      reroute: { id: 5 },
      group
    })

    invoke(undefined)

    expect(legacyMenuMock).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
    expect(stubCanvas.selectedItems.size).toBe(0)
  })

  it('keeps the menu open without re-selecting when only the group is selected', () => {
    group.selected = true
    stubCanvas.selectedItems.add(group)

    invoke(undefined)

    expect(stubCanvas.deselectAll).not.toHaveBeenCalled()
    expect(stubCanvas.selectedItems.size).toBe(1)
    expect(stubCanvas.selectedItems.has(group)).toBe(true)
    expect(stubCanvas.state.selectionChanged).toBe(false)
    expect(group.recomputeInsideNodes).not.toHaveBeenCalled()
    expect(mockUpdateSelectedItems).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it('reselects the group when selected child nodes would hide group actions', () => {
    const childNode = { selected: true }
    group.selected = true
    stubCanvas.selectedItems.add(group)
    stubCanvas.selectedItems.add(childNode)

    invoke(undefined)

    expect(stubCanvas.deselectAll).toHaveBeenCalledOnce()
    expect(stubCanvas.selectedItems.size).toBe(1)
    expect(stubCanvas.selectedItems.has(group)).toBe(true)
    expect(stubCanvas.state.selectionChanged).toBe(true)
    expect(group.recomputeInsideNodes).toHaveBeenCalledOnce()
    expect(mockUpdateSelectedItems).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it('falls through to the legacy menu when the canvas has no graph', () => {
    LGraphCanvas.prototype.processContextMenu.call(
      fromAny({ deselectAll: vi.fn() }),
      undefined,
      event
    )

    expect(mockGetCanvasContextMenuTarget).not.toHaveBeenCalled()
    expect(legacyMenuMock).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })
})
