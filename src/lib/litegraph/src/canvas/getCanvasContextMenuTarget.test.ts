import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'

const { mockQueryRerouteAtPoint } = vi.hoisted(() => ({
  mockQueryRerouteAtPoint: vi.fn<() => unknown>(() => null)
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: { queryRerouteAtPoint: mockQueryRerouteAtPoint }
}))

interface StubGraph {
  getReroute: ReturnType<typeof vi.fn>
  getRerouteOnPos: ReturnType<typeof vi.fn>
  getGroupOnPos: ReturnType<typeof vi.fn>
}

interface StubCanvas {
  graph: StubGraph | null
  links_render_mode: number
  _visibleReroutes: Set<unknown>
}

describe('getCanvasContextMenuTarget', () => {
  let graph: StubGraph
  let canvas: StubCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryRerouteAtPoint.mockReturnValue(null)
    graph = {
      getReroute: vi.fn(() => ({ id: 9 })),
      getRerouteOnPos: vi.fn(() => undefined),
      getGroupOnPos: vi.fn(() => ({ id: 1 }))
    }
    canvas = {
      graph,
      links_render_mode: LinkRenderType.SPLINE_LINK,
      _visibleReroutes: new Set()
    }
  })

  function resolve() {
    return getCanvasContextMenuTarget(fromAny(canvas), 10, 20)
  }

  it('returns the group under the point', () => {
    const target = resolve()

    expect(graph.getGroupOnPos).toHaveBeenCalledWith(10, 20)
    expect(target.group).toEqual({ id: 1 })
    expect(target.reroute).toBeUndefined()
  })

  it('resolves a reroute from the layout store without the positional fallback', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })

    const target = resolve()

    expect(graph.getReroute).toHaveBeenCalledWith(9)
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toEqual({ id: 9 })
  })

  it('falls back to the visible-scoped positional hit-test when the layout store misses', () => {
    graph.getRerouteOnPos.mockReturnValue({ id: 7 })

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toEqual({ id: 7 })
  })

  it('skips reroute detection when links are hidden', () => {
    canvas.links_render_mode = LinkRenderType.HIDDEN_LINK

    const target = resolve()

    expect(mockQueryRerouteAtPoint).not.toHaveBeenCalled()
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toBeUndefined()
    expect(target.group).toEqual({ id: 1 })
  })

  it('returns an empty target when the canvas has no graph', () => {
    canvas.graph = null

    expect(resolve()).toEqual({})
  })
})
