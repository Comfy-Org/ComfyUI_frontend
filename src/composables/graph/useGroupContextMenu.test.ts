import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGroupContextMenu } from '@/composables/graph/useGroupContextMenu'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'

const { mockShowNodeOptions, mockGetCanvasContextMenuTarget } = vi.hoisted(
  () => ({
    mockShowNodeOptions: vi.fn(),
    mockGetCanvasContextMenuTarget: vi.fn<
      () => { reroute?: unknown; link?: unknown; group?: unknown }
    >(() => ({}))
  })
)

vi.mock(import('@/composables/graph/useMoreOptionsMenu'), () => ({
  showNodeOptions: mockShowNodeOptions
}))

vi.mock<unknown>(
  import('@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'),
  () => ({
    getCanvasContextMenuTarget: mockGetCanvasContextMenuTarget
  })
)

interface StubCanvas {
  graph: LGraph
  deselectAll: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  setDirty: ReturnType<typeof vi.fn>
  selectedItems: Set<unknown>
}

describe('useGroupContextMenu', () => {
  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })
  let group: LGraphGroup
  let legacyMenuMock: ReturnType<typeof vi.fn>
  let stubCanvas: StubCanvas

  beforeEach(() => {
    LiteGraph.vueNodesMode = true
    const graph = createTestSubgraph({ rootGraph: new LGraph() })
    group = new LGraphGroup()
    graph.add(group)
    mockGetCanvasContextMenuTarget.mockReturnValue({ group })

    legacyMenuMock = vi.fn()
    LGraphCanvas.prototype.processContextMenu = fromAny(legacyMenuMock)

    useGroupContextMenu()

    stubCanvas = {
      graph,
      deselectAll: vi.fn(),
      select: vi.fn(),
      setDirty: vi.fn(),
      selectedItems: new Set()
    }
    stubCanvas.deselectAll.mockImplementation(() => {
      stubCanvas.selectedItems.clear()
    })
    stubCanvas.select.mockImplementation((item: unknown) => {
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

  function createRealCanvasHarness() {
    const graph = new LGraph()
    const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    const targetGroup = new LGraphGroup('Target')
    const node = new LGraphNode('Selected node')
    graph.add(targetGroup)
    graph.add(node)
    mockGetCanvasContextMenuTarget.mockReturnValue({ group: targetGroup })
    return { canvas, graph, node, targetGroup }
  }

  it('opens the Vue menu and selects only the group in Nodes 2.0 mode', () => {
    invoke(undefined)

    expect(stubCanvas.deselectAll).toHaveBeenCalledOnce()
    expect(stubCanvas.select).toHaveBeenCalledExactlyOnceWith(group, {
      selectGroupChildren: false
    })
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
    expect(stubCanvas.deselectAll.mock.invocationCallOrder[0]).toBeLessThan(
      stubCanvas.select.mock.invocationCallOrder[0]
    )
    expect(stubCanvas.select.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowNodeOptions.mock.invocationCallOrder[0]
    )
    expect(legacyMenuMock).not.toHaveBeenCalled()
  })

  it.for([false, true])(
    'selects only the group through the real canvas when child cascade is %s',
    (cascade) => {
      const { canvas, node, targetGroup } = createRealCanvasHarness()
      const selections: unknown[][] = []
      canvas.onSelectionChange = () => {
        selections.push([...canvas.selectedItems])
      }
      canvas.groupSelectChildren = cascade
      canvas.select(node)

      canvas.processContextMenu(undefined, event)

      expect(canvas.selectedItems).toEqual(new Set([targetGroup]))
      expect(selections.at(-1)).toEqual([targetGroup])
      expect(targetGroup.selected).toBe(true)
      expect(node.selected).toBe(false)
      expect(canvas.groupSelectChildren).toBe(cascade)
    }
  )

  it('preserves selected nodes when select-only mode rejects the group', () => {
    const { canvas, node } = createRealCanvasHarness()
    canvas.select(node)
    canvas.selectOnly = true

    canvas.processContextMenu(undefined, event)

    expect(canvas.selectedItems).toEqual(new Set([node]))
    expect(node.selected).toBe(true)
    expect(mockShowNodeOptions).toHaveBeenCalledWith(event)
  })

  it('keeps callback-visible cascade state and callback updates intact', () => {
    const { canvas, graph, node } = createRealCanvasHarness()
    const callbackGroup = new LGraphGroup('Callback group')
    callbackGroup._bounding.set([1000, 1000, 500, 500])
    const callbackChild = new LGraphNode('Callback child')
    callbackChild.pos = [1100, 1100]
    callbackChild.size = [100, 100]
    callbackChild.updateArea()
    graph.add(callbackGroup)
    graph.add(callbackChild)
    canvas.groupSelectChildren = true
    canvas.select(node)
    const observed: boolean[] = []
    node.onDeselected = () => {
      observed.push(canvas.groupSelectChildren)
      canvas.select(callbackGroup)
      canvas.groupSelectChildren = false
    }

    canvas.processContextMenu(undefined, event)

    expect(observed).toEqual([true])
    expect(callbackGroup.selected).toBe(true)
    expect(callbackChild.selected).toBe(true)
    expect(canvas.groupSelectChildren).toBe(false)
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

  it('falls through to the legacy menu when the cursor is on a link', () => {
    mockGetCanvasContextMenuTarget.mockReturnValue({
      link: { id: 5 },
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
    expect(stubCanvas.select).toHaveBeenCalledExactlyOnceWith(group, {
      selectGroupChildren: false
    })
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
