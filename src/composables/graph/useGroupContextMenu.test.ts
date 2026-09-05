import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGroupContextMenu } from '@/composables/graph/useGroupContextMenu'
import type {
  CanvasPointerEvent,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

const { mockShowNodeOptions, mockGetCanvasContextMenuTarget } = vi.hoisted(
  () => ({
    mockShowNodeOptions: vi.fn(),
    mockGetCanvasContextMenuTarget: vi.fn<
      () => { reroute?: unknown; group?: unknown }
    >(() => ({}))
  })
)

vi.mock('@/composables/graph/useMoreOptionsMenu', () => ({
  showNodeOptions: mockShowNodeOptions
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))

vi.mock('@/lib/litegraph/src/canvas/getCanvasContextMenuTarget', () => ({
  getCanvasContextMenuTarget: mockGetCanvasContextMenuTarget
}))

interface StubCanvas {
  graph: { id: string; rootGraph: { id: string } }
  groupSelectChildren: boolean
  deselectAll: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  selectedItems: Set<unknown>
}

describe('useGroupContextMenu', () => {
  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })
  let group: { id: number }
  let legacyMenuMock: ReturnType<typeof vi.fn>
  let stubCanvas: StubCanvas

  beforeEach(() => {
    LiteGraph.vueNodesMode = true
    group = { id: 1 }
    mockGetCanvasContextMenuTarget.mockReturnValue({ group })

    legacyMenuMock = vi.fn()
    LGraphCanvas.prototype.processContextMenu = fromAny(legacyMenuMock)

    useGroupContextMenu()

    stubCanvas = {
      graph: { id: 'root', rootGraph: { id: 'root' } },
      groupSelectChildren: true,
      deselectAll: vi.fn(),
      select: vi.fn(),
      selectedItems: new Set()
    }
    stubCanvas.deselectAll.mockImplementation(() => {
      stubCanvas.selectedItems.clear()
    })
    stubCanvas.select.mockImplementation((item: unknown) => {
      expect(stubCanvas.groupSelectChildren).toBe(false)
      stubCanvas.selectedItems.add(item)
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
    expect(stubCanvas.select).toHaveBeenCalledExactlyOnceWith(group)
    expect(stubCanvas.groupSelectChildren).toBe(true)
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(stubCanvas.deselectAll.mock.invocationCallOrder[0]).toBeLessThan(
      stubCanvas.select.mock.invocationCallOrder[0]
    )
    expect(stubCanvas.select.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowNodeOptions.mock.invocationCallOrder[0]
    )
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it('restores the child-cascade setting when select throws', () => {
    stubCanvas.select.mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => invoke(undefined)).toThrow('boom')
    expect(stubCanvas.groupSelectChildren).toBe(true)
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
    stubCanvas.selectedItems.add(group)

    invoke(undefined)

    expect(stubCanvas.deselectAll).not.toHaveBeenCalled()
    expect(stubCanvas.select).not.toHaveBeenCalled()
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it('reselects the group when selected child nodes would hide group actions', () => {
    stubCanvas.selectedItems.add(group)
    stubCanvas.selectedItems.add({ selected: true })

    invoke(undefined)

    expect(stubCanvas.deselectAll).toHaveBeenCalledOnce()
    expect(stubCanvas.select).toHaveBeenCalledExactlyOnceWith(group)
    expect([...stubCanvas.selectedItems]).toEqual([group])
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
