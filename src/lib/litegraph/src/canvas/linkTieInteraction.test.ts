import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addNode,
  createCanvas,
  pointerEvent
} from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import type { PointerEventType } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  LinkDirection,
  LinkRenderType
} from '@/lib/litegraph/src/types/globalEnums'
import {
  getLinkPolyline,
  setLinkPolyline
} from '@/renderer/core/canvas/linkPolylines'
import { useLinkTieStore } from '@/stores/linkTieStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import type { LinkTie } from '@/types/linkTie'

import {
  findLinkTieAtPoint,
  isLinkTieStroke,
  renderTiedLink,
  trackLinkTieKey
} from './linkTieInteraction'
import { routeThroughTies } from './linkTieGeometry'

vi.mock(import('@/services/litegraphService'))

const TIE_AT: [number, number] = [600, 500]
const PRIMARY = {
  button: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false
}

function tiedCanvas() {
  const graph = new LGraph()
  const origin = addNode(graph, 'Origin', 0, 0)
  const target = addNode(graph, 'Target', 300, 0)
  origin.addOutput('out', '*')
  target.addInput('in', '*')
  const link = origin.connect(0, target, 0)
  if (!link) throw new Error('Failed to connect test link')
  const canvas = createCanvas(graph)
  const scope = graphScopeOf(graph)
  const tie = useLinkTieStore().addTie(scope, {
    pos: TIE_AT,
    angle: 0,
    linkIds: [link.id]
  })
  return { canvas, graph, link, origin, scope, tie }
}

function holdZ(canvas: LGraphCanvas) {
  trackLinkTieKey(canvas, new KeyboardEvent('keydown', { code: 'KeyZ' }))
}

function fire(
  canvas: LGraphCanvas,
  type: PointerEventType,
  [x, y]: readonly [number, number],
  timeStamp: number,
  modifiers: { altKey?: boolean } = {}
) {
  const event = pointerEvent(type, x, y, { timeStamp, ...modifiers })
  if (type === 'pointerdown') canvas.processMouseDown(event)
  if (type === 'pointermove') canvas.processMouseMove(event)
  if (type === 'pointerup') canvas.processMouseUp(event)
}

function tiePos(scope: GraphScope, tie: LinkTie) {
  return useLinkTieStore()
    .getTies(scope)
    .find((candidate) => candidate.id === tie.id)?.pos
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('tie stroke arming', () => {
  it('disarms when the window loses focus or the page is hidden', () => {
    const { canvas } = tiedCanvas()

    holdZ(canvas)
    window.dispatchEvent(new Event('blur'))
    const afterBlur = isLinkTieStroke(canvas, PRIMARY)
    holdZ(canvas)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(afterBlur).toBe(false)
    expect(isLinkTieStroke(canvas, PRIMARY)).toBe(false)
  })

  it('disarms when the canvas unbinds its events', () => {
    const { canvas } = tiedCanvas()
    holdZ(canvas)

    canvas.unbindEvents()

    expect(isLinkTieStroke(canvas, PRIMARY)).toBe(false)
  })

  it.for(['altKey', 'ctrlKey', 'shiftKey', 'metaKey'] as const)(
    'does not claim a press with %s held',
    (modifier) => {
      const { canvas } = tiedCanvas()
      holdZ(canvas)

      expect(isLinkTieStroke(canvas, { ...PRIMARY, [modifier]: true })).toBe(
        false
      )
    }
  )

  it('leaves Alt-drag cloning to the node while Z is held', () => {
    const { canvas, graph, origin } = tiedCanvas()
    const cloning = LiteGraph.alt_drag_do_clone_nodes
    LiteGraph.alt_drag_do_clone_nodes = true
    canvas.visible_nodes = [...graph.nodes]
    const cloned = vi.spyOn(canvas, '_deserializeItems')
    holdZ(canvas)

    fire(canvas, 'pointerdown', [origin.pos[0] + 20, origin.pos[1] + 20], 1, {
      altKey: true
    })
    LiteGraph.alt_drag_do_clone_nodes = cloning

    expect(cloned).toHaveBeenCalledOnce()
  })
})

describe('tie dragging', () => {
  it('leaves the tie in place for a click within the drift threshold', () => {
    const { canvas, scope, tie } = tiedCanvas()

    fire(canvas, 'pointerdown', TIE_AT, 1)
    fire(canvas, 'pointermove', [TIE_AT[0] + 1, TIE_AT[1]], 2)
    fire(canvas, 'pointerup', [TIE_AT[0] + 1, TIE_AT[1]], 3)

    expect(tiePos(scope, tie)).toEqual(TIE_AT)
  })

  it('moves the tie to a release far from the press with no move between', () => {
    const { canvas, scope, tie } = tiedCanvas()

    fire(canvas, 'pointerdown', TIE_AT, 1)
    fire(canvas, 'pointerup', [TIE_AT[0] + 40, TIE_AT[1] + 30], 2)

    expect(tiePos(scope, tie)).toEqual([TIE_AT[0] + 40, TIE_AT[1] + 30])
  })

  it('ignores ties while links are hidden', () => {
    const { canvas, graph, scope, tie } = tiedCanvas()
    canvas.links_render_mode = LinkRenderType.HIDDEN_LINK

    fire(canvas, 'pointerdown', TIE_AT, 1)
    fire(canvas, 'pointerup', [TIE_AT[0] + 40, TIE_AT[1] + 30], 2)

    expect(findLinkTieAtPoint(canvas, graph, TIE_AT)).toBeUndefined()
    expect(tiePos(scope, tie)).toEqual(TIE_AT)
  })
})

describe('renderTiedLink', () => {
  it('publishes one hit path and one polyline covering every segment', () => {
    const { canvas, link, tie } = tiedCanvas()
    const segments = routeThroughTies(
      [tie],
      link.id,
      [0, 0],
      [900, 0],
      LinkDirection.RIGHT,
      LinkDirection.LEFT,
      4
    )
    const drawn: Path2D[] = []
    vi.spyOn(canvas, 'renderLink').mockImplementation((_ctx, a, b) => {
      const path = new Path2D()
      drawn.push(path)
      link.path = path
      setLinkPolyline(link, () => [
        { x: a[0], y: a[1] },
        { x: b[0], y: b[1] }
      ])
    })

    renderTiedLink(canvas, canvas.ctx, link, segments)

    const published = link.path
    if (!published) throw new Error('Expected a published hit path')
    expect(drawn).toHaveLength(2)
    expect(drawn).not.toContain(published)
    expect(vi.mocked(published.addPath).mock.calls).toEqual(
      drawn.map((path) => [path])
    )
    expect(getLinkPolyline(link)).toEqual([
      { x: 0, y: 0 },
      { x: TIE_AT[0], y: TIE_AT[1] },
      { x: TIE_AT[0], y: TIE_AT[1] },
      { x: 900, y: 0 }
    ])
  })
})
