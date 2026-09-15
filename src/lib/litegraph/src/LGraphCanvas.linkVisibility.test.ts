import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { i18n, loadLocale } from '@/i18n'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { drawHiddenLinkBadges } from '@/lib/litegraph/src/canvas/linkBadges'
import { LLink } from '@/lib/litegraph/src/LLink'
import { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas,
  createTestLink
} from '@/utils/__tests__/litegraphTestUtils'

function createLinkedNodes(graph: LGraph): LLink {
  const source = new LGraphNode('Source')
  source.addOutput('out', 'MODEL')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('in', 'MODEL')
  graph.add(target)
  return createTestLink(graph, source, 0, target, 0)
}

function createFixture() {
  const graph = new LGraph()
  const canvas = createTestCanvas(
    graph,
    createMockCanvasRenderingContext2D({
      lineWidth: 3,
      isPointInStroke: vi.fn().mockReturnValue(false),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      getTransform: vi
        .fn()
        .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
    })
  )
  const link = createLinkedNodes(graph)
  return { graph, canvas, link }
}

describe('LGraphCanvas link visibility interactions', () => {
  const event = fromPartial<CanvasPointerEvent>({ canvasX: 10, canvasY: 20 })

  it('adds hide and show actions while omitting reroutes for hidden links', () => {
    const { graph, canvas, link } = createFixture()
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
    canvas.showLinkMenu(link, event)

    expect(menu.mock.calls[0][0]).toEqual([
      { content: 'Hide Link', value: 'Hide Link' },
      null,
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
    void menu.mock.calls[0][1]?.callback?.({
      content: 'Hide Link',
      value: 'Hide Link'
    })
    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
        ?.hidden
    ).toBe(true)

    canvas.showLinkMenu(link, event)

    expect(menu.mock.calls[1][0]).toEqual([
      { content: 'Rename', value: 'Rename' },
      { content: 'Show Link', value: 'Show Link' },
      null,
      'Add Node',
      null,
      'Delete',
      null
    ])
    void menu.mock.calls[1][1]?.callback?.({
      content: 'Show Link',
      value: 'Show Link'
    })
    expect(
      useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
        ?.hidden
    ).toBeFalsy()
  })

  it('does not add visibility actions for a floating link', () => {
    const { graph, canvas, link } = createFixture()
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
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

    expect(menu.mock.calls[0][0]).toEqual([
      'Add Node',
      'Add Reroute',
      null,
      'Delete',
      null
    ])
  })

  it('opens the localized seeded rename prompt from the hidden-link menu', async () => {
    const { graph, canvas, link } = createFixture()
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
    useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
      hidden: true,
      label: 'Checkpoint'
    })
    const prompt = vi
      .spyOn(canvas, 'prompt')
      .mockReturnValue(document.createElement('div'))
    const originalLocale = i18n.global.locale.value

    await loadLocale('fr')
    i18n.global.locale.value = 'fr'
    try {
      canvas.showLinkMenu(link, event)
      void menu.mock.calls[0][1]?.callback?.({
        content: 'Renommer',
        value: 'Rename'
      })

      expect(prompt).toHaveBeenCalledWith(
        'Renommer',
        'Checkpoint',
        expect.any(Function),
        event
      )
      prompt.mock.calls[0][2]('Backbone')
      expect(
        useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
          ?.label
      ).toBe('Backbone')
    } finally {
      i18n.global.locale.value = originalLocale
    }
  })

  it('routes a visible curve right-click to the link menu', () => {
    const { canvas, link } = createFixture()
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).toHaveBeenCalledWith(link, event, link)
  })

  it('deletes the selected visible link and preserves its hidden shared-reroute sibling', () => {
    const { graph, canvas, link } = createFixture()
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
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))

    canvas.processContextMenu(undefined, event)

    void menu.mock.calls[0][1]?.callback?.('Delete')

    expect(graph.getLink(visibleLink.id)).toBeUndefined()
    expect(graph.getLink(link.id)).toBe(link)
  })

  it.for([false, true])(
    'respects selectOnly=%s when double-clicking a hidden badge',
    (selectOnly) => {
      const { graph, canvas, link } = createFixture()
      canvas.selectOnly = selectOnly
      useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
        hidden: true
      })
      drawHiddenLinkBadges(
        canvas,
        canvas.ctx,
        link,
        { hidden: true },
        [400, 300],
        [700, 300],
        '#89A',
        [0, 0, 800, 600]
      )
      const prompt = vi
        .spyOn(canvas, 'prompt')
        .mockReturnValue(document.createElement('div'))
      onTestFinished(() => canvas.pointer.reset())

      for (const timeStamp of [100, 200]) {
        const down = new PointerEvent('pointerdown', {
          button: 0,
          buttons: 1,
          isPrimary: true,
          pointerId: 1,
          clientX: 420,
          clientY: 300
        })
        const up = new PointerEvent('pointerup', {
          button: 0,
          buttons: 0,
          isPrimary: true,
          pointerId: 1,
          clientX: 420,
          clientY: 300
        })
        vi.spyOn(down, 'timeStamp', 'get').mockReturnValue(timeStamp)
        vi.spyOn(up, 'timeStamp', 'get').mockReturnValue(timeStamp + 20)
        canvas.processMouseDown(down)
        canvas.processMouseUp(up)
      }

      expect(prompt).toHaveBeenCalledTimes(selectOnly ? 0 : 1)
    }
  )

  it.for(['layout', 'path'])(
    'starts a Shift drag from a %s hit',
    (hitSource) => {
      const { graph, canvas, link } = createFixture()
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

      onTestFinished(() => canvas.pointer.reset())
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
    const { graph, canvas, link } = createFixture()
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })

    onTestFinished(() => canvas.pointer.reset())
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
    const { graph, canvas, link } = createFixture()
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

    onTestFinished(() => canvas.pointer.reset())
    canvas.processMouseDown(pointerEvent)
    canvas.pointer.onClick?.(pointerEvent as CanvasPointerEvent)

    expect(showLinkMenu).toHaveBeenCalledWith(link, pointerEvent)
    expect(createReroute).not.toHaveBeenCalled()
  })
})
