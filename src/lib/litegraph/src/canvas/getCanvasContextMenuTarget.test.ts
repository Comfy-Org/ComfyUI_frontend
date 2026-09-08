import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import { drawHiddenLinkBadges } from '@/lib/litegraph/src/canvas/linkBadges'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'

const { mockQueryLinkSegmentAtPoint, mockQueryRerouteAtPoint } = vi.hoisted(
  () => ({
    mockQueryLinkSegmentAtPoint: vi.fn<() => unknown>(() => null),
    mockQueryRerouteAtPoint: vi.fn<() => unknown>(() => null)
  })
)

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    queryLinkSegmentAtPoint: mockQueryLinkSegmentAtPoint,
    queryRerouteAtPoint: mockQueryRerouteAtPoint
  }
}))

let strokeHit = false
const isPointInStrokeMock = vi.fn()
function isPointInStroke(x: number, y: number): boolean
function isPointInStroke(path: Path2D, x: number, y: number): boolean
function isPointInStroke(
  ...args: [x: number, y: number] | [path: Path2D, x: number, y: number]
): boolean {
  isPointInStrokeMock(...args)
  return strokeHit
}

describe('getCanvasContextMenuTarget', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let group: LGraphGroup
  let reroute: Reroute

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockQueryLinkSegmentAtPoint.mockReturnValue(null)
    mockQueryRerouteAtPoint.mockReturnValue(null)
    isPointInStrokeMock.mockClear()
    strokeHit = false
    graph = new LGraph()
    group = new LGraphGroup('Group', toGroupId(1))
    reroute = new Reroute(toRerouteId(9), graph)
    vi.spyOn(graph, 'getReroute').mockReturnValue(reroute)
    vi.spyOn(graph, 'getRerouteOnPos').mockReturnValue(undefined)
    vi.spyOn(graph, 'getGroupOnPos').mockReturnValue(group)
    canvas = createTestCanvas(
      graph,
      createMockCanvasRenderingContext2D({
        lineWidth: 3,
        isPointInStroke
      })
    )
    canvas.connections_width = 3
    canvas.links_render_mode = LinkRenderType.SPLINE_LINK
  })

  function resolve() {
    return getCanvasContextMenuTarget(canvas, 10, 20)
  }

  function createLink(id: number): LLink {
    const link = new LLink(toLinkId(id), 'MODEL', 4, 0, 5, 0)
    graph.links.set(link.id, link)
    return link
  }

  function hide(link: LLink): void {
    useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
      hidden: true
    })
  }

  it('returns the group under the point', () => {
    const target = resolve()

    expect(graph.getGroupOnPos).toHaveBeenCalledWith(10, 20)
    expect(target.group).toBe(group)
    expect(target.reroute).toBeUndefined()
  })

  it('resolves a reroute from the layout store without the positional fallback', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    canvas.renderedPaths.add(reroute)

    const target = resolve()

    expect(mockQueryRerouteAtPoint).toHaveBeenCalledWith(graph.rootGraph.id, {
      x: 10,
      y: 20
    })
    expect(graph.getReroute).toHaveBeenCalledWith(9)
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toBe(reroute)
  })

  it('falls back when a layout hit names a reroute in another graph', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    vi.mocked(graph.getReroute).mockReturnValue(undefined)
    const fallback = new Reroute(toRerouteId(7), graph)
    vi.mocked(graph.getRerouteOnPos).mockReturnValue(fallback)

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toBe(fallback)
  })

  it('falls back to the visible-scoped positional hit-test when the layout store misses', () => {
    const fallback = new Reroute(toRerouteId(7), graph)
    vi.mocked(graph.getRerouteOnPos).mockReturnValue(fallback)

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toBe(fallback)
  })

  it('returns a visible link hit on its curve', () => {
    const link = createLink(4)
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    canvas.renderedPaths.add(link)

    const target = resolve()

    expect(mockQueryLinkSegmentAtPoint).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      canvas.ctx
    )
    expect(target.link).toBe(link)
  })

  it.for([0.5, 2])('falls back to current-frame paths at DPI %s', (dpi) => {
    vi.stubGlobal('devicePixelRatio', dpi)
    const link = createLink(4)
    link.path = fromPartial<Path2D>({})
    canvas.renderedPaths.add(link)
    strokeHit = true

    const target = resolve()

    const scale = Math.max(dpi, 1)
    expect(isPointInStrokeMock).toHaveBeenCalledWith(
      link.path,
      10 * scale,
      20 * scale
    )
    expect(target.link).toBe(link)
    expect(canvas.ctx.lineWidth).toBe(3)
  })

  it('restores stroke width when layout hit testing throws', () => {
    mockQueryLinkSegmentAtPoint.mockImplementation(() => {
      throw new Error('Layout unavailable')
    })

    expect(resolve).toThrow('Layout unavailable')
    expect(canvas.ctx.lineWidth).toBe(3)
  })

  it('returns a hidden link hit on its badge', () => {
    const link = createLink(5)
    hide(link)
    drawHiddenLinkBadges(
      canvas,
      canvas.ctx,
      link,
      { hidden: true },
      [-10, 20],
      [200, 20],
      '#cab8ff',
      [0, 0, 800, 600]
    )
    const target = resolve()

    expect(target.link).toBe(link)
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
  })

  it('skips a revealed hidden curve and returns the visible link behind it', () => {
    const hiddenLink = createLink(5)
    hide(hiddenLink)
    hiddenLink.path = fromPartial<Path2D>({})
    const visibleLink = createLink(6)
    visibleLink.path = fromPartial<Path2D>({})
    canvas.renderedPaths.add(hiddenLink)
    canvas.renderedPaths.add(visibleLink)
    strokeHit = true

    const target = resolve()

    expect(target.link).toBe(visibleLink)
  })

  it('does not return a hidden link from a stale curve layout', () => {
    const link = createLink(5)
    hide(link)
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    const target = resolve()

    expect(target.link).toBeUndefined()
  })

  it('gives a reroute precedence over a link at the same point', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    canvas.renderedPaths.add(reroute)
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: toLinkId(4),
      rerouteId: toRerouteId(9)
    })

    const target = resolve()

    expect(target.reroute).toBe(reroute)
    expect(target.link).toBeUndefined()
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
  })

  it('ignores a non-rendered layout reroute and resolves the badge beneath it', () => {
    const link = createLink(5)
    hide(link)
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    drawHiddenLinkBadges(
      canvas,
      canvas.ctx,
      link,
      { hidden: true },
      [-10, 20],
      [200, 20],
      '#cab8ff',
      [0, 0, 800, 600]
    )

    const target = resolve()

    expect(target.reroute).toBeUndefined()
    expect(target.link).toBe(link)
    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
  })

  it('skips reroute detection when links are hidden', () => {
    canvas.links_render_mode = LinkRenderType.HIDDEN_LINK

    const target = resolve()

    expect(mockQueryRerouteAtPoint).not.toHaveBeenCalled()
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toBeUndefined()
    expect(target.group).toBe(group)
  })

  it('returns an empty target when the canvas has no graph', () => {
    canvas.graph = null

    expect(resolve()).toEqual({})
  })
})
