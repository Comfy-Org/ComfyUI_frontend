import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CanvasPointerEvent,
  IContextMenuOptions,
  IContextMenuValue,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import {
  createMockCanvas2DContext,
  createTestCanvas,
  createTestLink
} from '@/utils/__tests__/litegraphTestUtils'

type MenuValue = string | IContextMenuValue<string> | null

function createLinkedNodes(graph: LGraph): LLink {
  const source = new LGraphNode('Source')
  source.addOutput('out', 'MODEL')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('in', 'MODEL')
  graph.add(target)
  return createTestLink(graph, source, 0, target, 0)
}

describe('LGraphCanvas link visibility interactions', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let link: LLink
  let originalContextMenu: typeof LiteGraph.ContextMenu
  let menuValues: readonly MenuValue[] = []
  let menuOptions: IContextMenuOptions<string> = {}

  beforeEach(() => {
    menuValues = []
    menuOptions = {}
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    canvas = createTestCanvas(
      graph,
      createMockCanvas2DContext({
        lineWidth: 3,
        isPointInStroke: vi.fn().mockReturnValue(false),
        measureText: vi.fn().mockReturnValue({ width: 50 }),
        getTransform: vi
          .fn()
          .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      })
    )
    link = createLinkedNodes(graph)
    originalContextMenu = LiteGraph.ContextMenu
    const MockContextMenu = fromPartial<typeof LiteGraph.ContextMenu>(
      class {
        constructor(
          values: readonly MenuValue[],
          options: IContextMenuOptions<string>
        ) {
          menuValues = values
          menuOptions = options
        }
      }
    )
    LiteGraph.ContextMenu = MockContextMenu
  })

  afterEach(() => {
    canvas.pointer.finally?.()
    LiteGraph.ContextMenu = originalContextMenu
  })

  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })

  it('adds hide and show actions while omitting reroutes for hidden links', () => {
    canvas.showLinkMenu(link, event)

    expect(menuValues).toEqual([
      'Hide Link',
      null,
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
    void menuOptions.callback?.('Hide Link')
    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
        ?.hidden
    ).toBe(true)

    canvas.showLinkMenu(link, event)

    expect(menuValues).toEqual([
      'Rename',
      'Show Link',
      null,
      'Add Node',
      null,
      'Delete',
      null
    ])
    void menuOptions.callback?.('Show Link')
    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
        ?.hidden
    ).toBeFalsy()
  })

  it('does not add visibility actions for a floating link', () => {
    const floating = new LLink(
      toLinkId(99),
      'MODEL',
      link.origin_id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(floating)

    canvas.showLinkMenu(floating, event)

    expect(menuValues).toEqual([
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
  })

  it('opens the seeded rename prompt from the hidden-link menu', () => {
    useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
      hidden: true,
      label: 'Checkpoint'
    })
    const prompt = vi
      .spyOn(canvas, 'prompt')
      .mockReturnValue(document.createElement('div'))

    canvas.showLinkMenu(link, event)
    void menuOptions.callback?.('Rename')

    expect(prompt).toHaveBeenCalledWith(
      'Rename',
      'Checkpoint',
      expect.any(Function),
      event
    )
    prompt.mock.calls[0][2]('Backbone')
    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
        ?.label
    ).toBe('Backbone')
  })

  it('routes a visible curve right-click to the link menu', () => {
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).toHaveBeenCalledWith(link, event)
  })

  it('opens the visible link menu from a shared reroute segment', () => {
    const source = graph.getNodeById(link.origin_id)
    if (!source) throw new Error('Missing source node')
    const target = new LGraphNode('Other target')
    target.addInput('in', 'MODEL')
    graph.add(target)
    const visibleLink = createTestLink(graph, source, 0, target, 0)
    useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
      hidden: true
    })
    const reroute = graph.createReroute([-100, -100], link)
    if (!reroute) throw new Error('Missing shared reroute')
    visibleLink.parentId = reroute.id
    canvas.renderedPaths.add(reroute)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: reroute.id
    })
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).toHaveBeenCalledWith(visibleLink, event)
  })

  it.for(['layout', 'path'])(
    'starts a Shift drag from a %s hit',
    (hitSource) => {
      canvas.renderedPaths.add(link)
      link.path = fromPartial<Path2D>({})
      vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
      vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue(
        hitSource === 'layout' ? { linkId: link.id, rerouteId: null } : null
      )
      vi.spyOn(canvas.ctx, 'isPointInStroke').mockReturnValue(
        hitSource === 'path'
      )
      const drag = vi.spyOn(canvas.linkConnector, 'dragFromLinkSegment')
      const lineWidth = canvas.ctx.lineWidth

      canvas.processMouseDown(
        new PointerEvent('pointerdown', {
          button: 0,
          clientX: 400,
          clientY: 300,
          shiftKey: true,
          isPrimary: false
        })
      )

      expect(drag).toHaveBeenCalledWith(graph, link)
      expect(canvas.ctx.lineWidth).toBe(lineWidth)
    }
  )

  it('inserts a reroute when Alt-clicking a rendered curve', () => {
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })

    canvas.processMouseDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 400,
        clientY: 300,
        altKey: true,
        isPrimary: false
      })
    )

    expect(graph.reroutes.size).toBe(1)
    expect(link.parentId).toBe([...graph.reroutes.keys()][0])
    expect(canvas.ctx.lineWidth).toBe(3)
  })

  it('keeps an earlier marker ahead of a later Alt-clicked curve', () => {
    const laterLink = createLinkedNodes(graph)
    link._pos[0] = 400
    link._pos[1] = 300
    canvas.linkMarkerShape = LinkMarkerShape.Circle
    canvas.renderedPaths.add(link)
    canvas.renderedPaths.add(laterLink)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: laterLink.id,
      rerouteId: null
    })
    const createReroute = vi.spyOn(graph, 'createReroute')
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)
    const pointerEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: true,
      isPrimary: false
    })

    canvas.processMouseDown(pointerEvent)
    canvas.pointer.onClick?.(pointerEvent as CanvasPointerEvent)

    expect(showLinkMenu).toHaveBeenCalledWith(link, pointerEvent)
    expect(createReroute).not.toHaveBeenCalled()
  })
})
