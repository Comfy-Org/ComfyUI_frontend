import {
  afterEach,
  assert,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'

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
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkTieStore } from '@/stores/linkTieStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
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
const TIE_ANGLE = 0.25
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
  assert.exists(link)
  const canvas = createCanvas(graph)
  const scope = graphScopeOf(graph)
  const tie = useLinkTieStore().addTie(scope, {
    pos: TIE_AT,
    angle: TIE_ANGLE,
    linkIds: [link.id]
  })
  canvas.renderedPaths.add(link)
  canvas.visible_area.set([-100, -100, 1000, 800])
  return { canvas, graph, link, origin, scope, tie }
}

function drawCtx(): CanvasRenderingContext2D {
  return createMockCanvasRenderingContext2D({
    translate: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    bezierCurveTo: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    fillText: vi.fn(),
    closePath: vi.fn(),
    isPointInStroke: vi.fn().mockReturnValue(false)
  })
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
  it.for([
    { trigger: 'window blur', target: () => window, type: 'blur' },
    {
      trigger: 'a visibility change',
      target: () => document,
      type: 'visibilitychange'
    }
  ])('disarms on $trigger', ({ target, type }) => {
    const { canvas } = tiedCanvas()
    holdZ(canvas)

    target().dispatchEvent(new Event(type))

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
    const { canvas, graph } = tiedCanvas()
    const cloning = LiteGraph.alt_drag_do_clone_nodes
    LiteGraph.alt_drag_do_clone_nodes = true
    onTestFinished(() => {
      LiteGraph.alt_drag_do_clone_nodes = cloning
    })
    const node = createTestNode(graph, [], ['*'])
    node.pos = [100, 300]
    node.size = [100, 60]
    node.updateArea()
    canvas.visible_nodes = [...graph.nodes]
    const nodeCount = graph.nodes.length
    holdZ(canvas)

    fire(canvas, 'pointerdown', [120, 320], 1, { altKey: true })

    expect(graph.nodes).toHaveLength(nodeCount + 1)
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

describe('tie visibility', () => {
  it('draws and hit-tests a tie while one of its links is drawn', () => {
    const { canvas, graph } = tiedCanvas()
    const ctx = drawCtx()

    canvas.drawConnections(ctx)

    expect(ctx.rotate).toHaveBeenCalledWith(TIE_ANGLE)
    expect(findLinkTieAtPoint(canvas, graph, TIE_AT)).toBeDefined()
  })

  it('keeps a tie whose link endpoints are off screen while the tie is on screen', () => {
    const { canvas, graph } = tiedCanvas()
    canvas.visible_area.set([TIE_AT[0] - 50, TIE_AT[1] - 50, 100, 100])
    const ctx = drawCtx()

    canvas.drawConnections(ctx)

    expect(ctx.rotate).toHaveBeenCalledWith(TIE_ANGLE)
    expect(findLinkTieAtPoint(canvas, graph, TIE_AT)).toBeDefined()
  })

  it('neither draws nor hit-tests a tie whose links are all hidden', () => {
    const { canvas, graph, link, scope, tie } = tiedCanvas()
    useLinkPresentationStore().patch(scope, link.id, { hidden: true })
    const ctx = drawCtx()

    canvas.drawConnections(ctx)
    fire(canvas, 'pointerdown', TIE_AT, 1)
    fire(canvas, 'pointerup', [TIE_AT[0] + 40, TIE_AT[1] + 30], 2)

    expect(ctx.rotate).not.toHaveBeenCalledWith(TIE_ANGLE)
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
    assert.exists(published)
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
