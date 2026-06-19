import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGroupContextMenu } from '@/composables/graph/useGroupContextMenu'
import type {
  CanvasPointerEvent,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'

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
  graph: {
    getGroupOnPos: ReturnType<typeof vi.fn>
    getRerouteOnPos: ReturnType<typeof vi.fn>
  }
  deselectAll: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  links_render_mode: number
}

describe('useGroupContextMenu', () => {
  const group = { id: 1 }
  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })
  let originalSpy: ReturnType<typeof vi.fn>
  let stubCanvas: StubCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryRerouteAtPoint.mockReturnValue(null)
    LiteGraph.vueNodesMode = true

    originalSpy = vi.fn()
    LGraphCanvas.prototype.processContextMenu = fromAny(originalSpy)

    useGroupContextMenu()

    stubCanvas = {
      graph: {
        getGroupOnPos: vi.fn(() => group),
        getRerouteOnPos: vi.fn(() => undefined)
      },
      deselectAll: vi.fn(),
      select: vi.fn(),
      links_render_mode: LinkRenderType.SPLINE_LINK
    }
  })

  function invoke(node: LGraphNode | undefined) {
    LGraphCanvas.prototype.processContextMenu.call(fromAny(stubCanvas), node, event)
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
    invoke(fromPartial<LGraphNode>({}))

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

  it('keeps the legacy menu when the layout store reports a reroute', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 5 })

    invoke(undefined)

    expect(stubCanvas.graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(stubCanvas.graph.getGroupOnPos).not.toHaveBeenCalled()
    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('keeps the legacy menu when getRerouteOnPos finds a reroute the layout store missed', () => {
    stubCanvas.graph.getRerouteOnPos.mockReturnValue({ id: 5 })

    invoke(undefined)

    expect(stubCanvas.graph.getGroupOnPos).not.toHaveBeenCalled()
    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })

  it('skips the reroute check and opens the group menu when links are hidden', () => {
    stubCanvas.links_render_mode = LinkRenderType.HIDDEN_LINK

    invoke(undefined)

    expect(mockQueryRerouteAtPoint).not.toHaveBeenCalled()
    expect(stubCanvas.graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(stubCanvas.select).toHaveBeenCalledWith(group)
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(originalSpy).not.toHaveBeenCalled()
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
    LGraphCanvas.prototype.processContextMenu.call(
      fromAny({ deselectAll: vi.fn(), select: vi.fn() }),
      undefined,
      event
    )

    expect(originalSpy).toHaveBeenCalledOnce()
    expect(mockShowNodeOptions).not.toHaveBeenCalled()
  })
})
