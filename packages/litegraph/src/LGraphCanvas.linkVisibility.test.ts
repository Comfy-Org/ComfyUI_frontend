import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { provideTranslator } from './translate'
import type { CanvasPointerEvent, LGraphCanvas } from './litegraph'
import { LGraph, LGraphNode, LiteGraph } from './litegraph'
import {
  clearLinkBadgeHitAreas,
  collapseLinkBadgeStacks,
  drawHiddenLinkBadges,
  layoutHiddenLinkBadges,
  queryLinkBadgeAtPoint,
  queryLinkBadgeHitAtPoint
} from './canvas/linkBadges'
import { LLink } from './LLink'
import { LinkMarkerShape } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import { layoutStore } from '@comfyorg/graph-state/layout/layoutStore'
import { useLinkPresentationStore } from '@comfyorg/graph-state/linkPresentationStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { createTestLink } from './__fixtures__/litegraphTestUtils'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from './__fixtures__/canvasTestUtils'

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

  it('opens the localized seeded rename prompt from the hidden-link menu', () => {
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
    provideTranslator((key, fallback) =>
      key === 'contextMenu.Rename' ? 'Renommer' : fallback
    )
    onTestFinished(() => provideTranslator(undefined))

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
  })

  it('routes a right-click on a visible centre marker to the link menu', () => {
    const { canvas, link } = createFixture()
    link._pos = [10, 20]
    canvas.linkMarkerShape = LinkMarkerShape.Circle
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).toHaveBeenCalledWith(link, event, link)
  })

  it('leaves a right-click on a visible curve to the canvas menu', () => {
    const { canvas, link } = createFixture()
    link._pos = [300, 400]
    canvas.linkMarkerShape = LinkMarkerShape.Circle
    canvas.renderedPaths.add(link)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
    vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    const showLinkMenu = vi.spyOn(canvas, 'showLinkMenu').mockReturnValue(false)
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))

    canvas.processContextMenu(undefined, event)

    expect(showLinkMenu).not.toHaveBeenCalled()
    expect(menu).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'left', button: 0, buttons: 1, alreadyHidden: false },
    { name: 'right', button: 2, buttons: 2, alreadyHidden: false },
    { name: 'left', button: 0, buttons: 1, alreadyHidden: true },
    { name: 'right', button: 2, buttons: 2, alreadyHidden: true }
  ] as const)(
    'hides all links through a shared segment with $name click (hidden sibling: $alreadyHidden)',
    ({ button, buttons, alreadyHidden }) => {
      const { graph, canvas, link } = createFixture()
      const source = graph.getNodeById(link.origin_id)
      assert.exists(source)
      const targets = [
        new LGraphNode('Sibling'),
        new LGraphNode('Other branch')
      ]
      const [sibling, otherBranch] = targets.map((target) => {
        target.addInput('in', 'MODEL')
        graph.add(target)
        return createTestLink(graph, source, 0, target, 0)
      })
      const upstream = graph.createReroute([500, 200], otherBranch)
      const shared = graph.createReroute([600, 300], link)
      assert.exists(upstream)
      assert.exists(shared)
      shared.parentId = upstream.id
      sibling.parentId = shared.id
      shared._pos = [400, 300]
      canvas.linkMarkerShape = LinkMarkerShape.Circle
      canvas.renderedPaths.add(shared)
      vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
      vi.spyOn(layoutStore, 'queryLinkSegmentAtPoint').mockReturnValue({
        linkId: link.id,
        rerouteId: shared.id
      })
      const store = useLinkPresentationStore()
      const scope = graphScopeOf(graph)
      store.patch(scope, link.id, {
        hidden: alreadyHidden,
        label: 'Keep label'
      })
      const before = graph.serialize()
      const beforeChange = vi.spyOn(canvas, 'emitBeforeChange')
      const afterChange = vi.spyOn(canvas, 'emitAfterChange')
      const menu = vi
        .spyOn(LiteGraph, 'ContextMenu')
        .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))

      onTestFinished(() => canvas.pointer.reset())
      canvas.processMouseDown(
        new PointerEvent('pointerdown', {
          button,
          buttons,
          isPrimary: true,
          pointerId: 1,
          clientX: 400,
          clientY: 300
        })
      )
      canvas.processMouseUp(
        new PointerEvent('pointerup', {
          button,
          buttons: 0,
          isPrimary: true,
          pointerId: 1,
          clientX: 400,
          clientY: 300
        })
      )

      const hide = menu.mock.calls[0][0].find(
        (option) => typeof option === 'object' && option?.value === 'Hide Link'
      )
      assert.exists(hide)
      void menu.mock.calls[0][1]?.callback?.(hide)

      expect(store.getPresentation(scope, link.id)).toEqual({
        hidden: true,
        label: 'Keep label'
      })
      expect(store.getPresentation(scope, sibling.id)?.hidden).toBe(true)
      expect(store.getPresentation(scope, otherBranch.id)?.hidden).toBeFalsy()
      expect(beforeChange).toHaveBeenCalledTimes(1)
      expect(afterChange).toHaveBeenCalledTimes(1)
      graph.configure(before)
      expect(store.getPresentation(scope, link.id)?.hidden === true).toBe(
        alreadyHidden
      )
      expect(store.getPresentation(scope, sibling.id)?.hidden).toBeFalsy()
    }
  )

  it('hides only the terminal branch and keeps shared floating links visible', () => {
    const { graph, canvas, link } = createFixture()
    const source = graph.getNodeById(link.origin_id)
    assert.exists(source)
    const target = new LGraphNode('Other target')
    target.addInput('in', 'MODEL')
    graph.add(target)
    const sibling = createTestLink(graph, source, 0, target, 0)
    const reroute = graph.createReroute([400, 300], link)
    assert.exists(reroute)
    sibling.parentId = reroute.id
    const floating = new LLink(
      toLinkId(99),
      'MODEL',
      link.origin_id,
      0,
      UNASSIGNED_NODE_ID,
      -1,
      reroute.id
    )
    graph.addFloatingLink(floating)
    const menu = vi
      .spyOn(LiteGraph, 'ContextMenu')
      .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)

    canvas.showLinkMenu(link, event)
    void menu.mock.calls[0][1]?.callback?.('Hide Link')

    expect(store.getPresentation(scope, link.id)?.hidden).toBe(true)
    expect(store.getPresentation(scope, sibling.id)?.hidden).toBeFalsy()
    expect(store.getPresentation(scope, floating.id)).toBeUndefined()

    canvas.showLinkMenu(reroute, event)
    void menu.mock.calls[1][1]?.callback?.('Hide Link')

    expect(store.getPresentation(scope, sibling.id)?.hidden).toBe(true)
    expect(store.getPresentation(scope, floating.id)).toBeUndefined()
    expect(graph.floatingLinks.get(floating.id)).toBe(floating)
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
    reroute._pos = [10, 20]
    canvas.linkMarkerShape = LinkMarkerShape.Circle
    canvas.renderedPaths.add(reroute)
    vi.spyOn(layoutStore, 'queryRerouteAtPoint').mockReturnValue(null)
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
      layoutHiddenLinkBadges(canvas, canvas.ctx, [
        {
          link,
          presentation: { hidden: true },
          startPos: [400, 300],
          endPos: [700, 300],
          color: '#89A'
        }
      ])
      drawHiddenLinkBadges(canvas.ctx, canvas, [0, 0, 800, 600])
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

  describe('stacked hidden link badges', () => {
    function createStackFixture(
      labels: readonly (string | undefined)[] = [undefined, undefined]
    ) {
      vi.useFakeTimers()
      const { graph, canvas, link } = createFixture()
      onTestFinished(() => {
        collapseLinkBadgeStacks(canvas)
        vi.useRealTimers()
      })
      const source = graph.getNodeById(link.origin_id)
      assert.exists(source)
      const links = labels.map((_, index) => {
        if (index === 0) return link
        const target = new LGraphNode(`Target ${index}`)
        target.addInput('in', 'MODEL')
        graph.add(target)
        return createTestLink(graph, source, 0, target, 0)
      })
      const scope = graphScopeOf(graph)
      const store = useLinkPresentationStore()
      links.forEach((hidden, index) =>
        store.patch(scope, hidden.id, { hidden: true, label: labels[index] })
      )
      const labelOf = (hidden: LLink) =>
        store.getPresentation(scope, hidden.id)?.label
      const relayout = () =>
        layoutHiddenLinkBadges(
          canvas,
          canvas.ctx,
          links.map((hidden, index) => ({
            link: hidden,
            presentation: { hidden: true, label: labelOf(hidden) },
            startPos: [400, 300],
            endPos: [700, 300 + index * 100],
            color: '#89A'
          }))
        )
      relayout()
      drawHiddenLinkBadges(canvas.ctx, canvas, [0, 0, 800, 600])
      onTestFinished(() => canvas.pointer.reset())
      const prompt = vi
        .spyOn(canvas, 'prompt')
        .mockReturnValue(document.createElement('div'))
      const submitPrompt = (value: string) => {
        prompt.mock.calls[0][2](value)
        relayout()
      }
      return { graph, canvas, links, relayout, prompt, submitPrompt, labelOf }
    }

    function singleClickAt(
      canvas: LGraphCanvas,
      clientX: number,
      clientY: number
    ) {
      const init = { isPrimary: true, pointerId: 1, clientX, clientY }
      canvas.processMouseDown(
        new PointerEvent('pointerdown', { ...init, button: 0, buttons: 1 })
      )
      canvas.processMouseUp(
        new PointerEvent('pointerup', { ...init, button: 0, buttons: 0 })
      )
      vi.advanceTimersByTime(300)
    }

    it('waits to expand and cancels expansion throughout a held double click', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      vi.advanceTimersByTime(79)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()

      const release = holdPressAt(canvas, 420, 300, 200)
      vi.advanceTimersByTime(600)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
      release()
      expect(prompt).toHaveBeenCalledOnce()
      vi.advanceTimersByTime(600)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it('expands after the double-click window and collapses on Escape', () => {
      const { canvas, links, relayout } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      vi.advanceTimersByTime(299)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
      vi.advanceTimersByTime(1)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBe(links[0].id)

      canvas.processKey(new KeyboardEvent('keydown', { key: 'Escape' }))
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it.for([
      {
        name: 'Escape',
        dismiss: (canvas) =>
          canvas.processKey(new KeyboardEvent('keydown', { key: 'Escape' }))
      },
      {
        name: 'an empty-canvas click',
        dismiss: (canvas) => pressAt(canvas, 100, 100, 200)
      },
      {
        name: 'graph replacement',
        dismiss: (canvas, graph) => {
          canvas.setGraph(new LGraph())
          canvas.setGraph(graph)
        }
      },
      { name: 'canvas clear', dismiss: (canvas) => canvas.clear() },
      { name: 'event unbinding', dismiss: (canvas) => canvas.unbindEvents() }
    ] satisfies {
      name: string
      dismiss: (canvas: LGraphCanvas, graph: LGraph) => void
    }[])('cancels pending expansion after $name', ({ dismiss }) => {
      const { canvas, graph, relayout } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      dismiss(canvas, graph)
      relayout()
      vi.advanceTimersByTime(600)
      relayout()

      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it('expands independently clicked stacks after an intervening redraw', () => {
      const { canvas, links, relayout } = createStackFixture([
        undefined,
        undefined,
        'other',
        'other'
      ])

      pressAt(canvas, 420, 300, 100)
      pressAt(canvas, 420, 325, 200)
      clearLinkBadgeHitAreas(canvas)
      relayout()
      vi.advanceTimersByTime(300)
      const layout = relayout()
      const first = layout.get(links[0].id)
      const second = layout.get(links[2].id)
      assert.exists(first)
      assert.exists(second)

      expect(queryLinkBadgeAtPoint(canvas, ...first.output.tip)).toBe(
        links[0].id
      )
      expect(queryLinkBadgeAtPoint(canvas, ...second.output.tip)).toBe(
        links[2].id
      )
    })

    it('expands a held stack after another stack expands during the press', () => {
      const { canvas, links, relayout } = createStackFixture([
        undefined,
        undefined,
        'other',
        'other'
      ])

      pressAt(canvas, 420, 300, 100)
      const release = holdPressAt(canvas, 478, 325, 200)
      vi.advanceTimersByTime(300)
      relayout()
      release()
      vi.advanceTimersByTime(300)
      const layout = relayout()
      const second = layout.get(links[2].id)
      assert.exists(second)

      expect(queryLinkBadgeAtPoint(canvas, ...second.output.tip)).toBe(
        links[2].id
      )
    })

    it('keeps an expanded stack open while panning from empty canvas', () => {
      const { canvas, relayout } = createStackFixture()
      singleClickAt(canvas, 420, 300)
      relayout()

      const init = { isPrimary: true, pointerId: 1, button: 0 }
      canvas.processMouseDown(
        new PointerEvent('pointerdown', {
          ...init,
          buttons: 1,
          clientX: 100,
          clientY: 100
        })
      )
      canvas.processMouseMove(
        new PointerEvent('pointermove', {
          ...init,
          buttons: 1,
          clientX: 160,
          clientY: 160
        })
      )
      canvas.processMouseUp(
        new PointerEvent('pointerup', {
          ...init,
          buttons: 0,
          clientX: 160,
          clientY: 160
        })
      )
      relayout()

      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeDefined()
    })

    it('expands a stack when the click drifts off the pill before release', () => {
      const { canvas, links, relayout } = createStackFixture()
      const init = { isPrimary: true, pointerId: 1, button: 0 }
      canvas.processMouseDown(
        new PointerEvent('pointerdown', {
          ...init,
          buttons: 1,
          clientX: 420,
          clientY: 310
        })
      )
      canvas.processMouseUp(
        new PointerEvent('pointerup', {
          ...init,
          buttons: 0,
          clientX: 420,
          clientY: 315
        })
      )
      vi.advanceTimersByTime(300)
      relayout()

      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBe(links[0].id)
    })

    function pressAt(
      canvas: LGraphCanvas,
      clientX: number,
      clientY: number,
      timeStamp: number
    ) {
      const init = { isPrimary: true, pointerId: 1, clientX, clientY }
      const down = new PointerEvent('pointerdown', {
        ...init,
        button: 0,
        buttons: 1
      })
      const up = new PointerEvent('pointerup', {
        ...init,
        button: 0,
        buttons: 0
      })
      vi.spyOn(down, 'timeStamp', 'get').mockReturnValue(timeStamp)
      vi.spyOn(up, 'timeStamp', 'get').mockReturnValue(timeStamp + 20)
      canvas.processMouseDown(down)
      canvas.processMouseUp(up)
    }

    function doubleClickAt(
      canvas: LGraphCanvas,
      clientX: number,
      clientY: number
    ) {
      pressAt(canvas, clientX, clientY, 100)
      pressAt(canvas, clientX, clientY, 200)
    }

    const stackedLinkIdsAt = (canvas: LGraphCanvas, x: number, y: number) => {
      const hit = queryLinkBadgeHitAtPoint(canvas, x, y)
      return hit?.stackKey ? hit.linkIds : undefined
    }

    it('keeps the stack collapsed while renaming it in one batch', () => {
      const { canvas, links, relayout, prompt, submitPrompt, labelOf } =
        createStackFixture([undefined, undefined, 'untouched'])

      pressAt(canvas, 420, 300, 100)
      relayout()
      pressAt(canvas, 420, 300, 200)

      expect(prompt).toHaveBeenCalledWith(
        'Rename',
        '',
        expect.any(Function),
        expect.anything()
      )
      vi.advanceTimersByTime(600)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBe(links[2].id)
      submitPrompt('render_size')

      expect(links.map(labelOf)).toEqual([
        'render_size',
        'render_size',
        'untouched'
      ])
      expect(stackedLinkIdsAt(canvas, 420, 300)).toEqual(
        links.slice(0, 2).map(({ id }) => id)
      )
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBe(links[2].id)
    })

    it('renames the whole stack when the double click lands on its layer edge', () => {
      const { canvas, links, relayout, submitPrompt, labelOf } =
        createStackFixture([undefined, undefined, undefined])

      pressAt(canvas, 420, 313, 100)
      relayout()
      pressAt(canvas, 420, 313, 200)
      submitPrompt('edge')

      expect(links.map(labelOf)).toEqual(['edge', 'edge', 'edge'])
      expect(queryLinkBadgeAtPoint(canvas, 420, 335)).toBeUndefined()
    })

    it('does not retarget a second click beside the head back to the stack', () => {
      const { canvas, relayout, prompt } = createStackFixture([
        undefined,
        undefined,
        undefined
      ])
      pressAt(canvas, 420, 300, 100)
      vi.advanceTimersByTime(300)
      relayout()

      pressAt(canvas, 420, 300, 500)
      relayout()
      pressAt(canvas, 420, 284, 600)
      relayout()

      expect(prompt).not.toHaveBeenCalled()
      expect(queryLinkBadgeAtPoint(canvas, 420, 335)).toBeUndefined()
    })

    it('opens no rename prompt when the canvas turns read-only between the two clicks', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      relayout()
      canvas.read_only = true
      pressAt(canvas, 420, 300, 200)

      expect(prompt).not.toHaveBeenCalled()
    })

    function holdPressAt(
      canvas: LGraphCanvas,
      clientX: number,
      clientY: number,
      timeStamp: number
    ) {
      const init = { isPrimary: true, pointerId: 1, clientX, clientY }
      const down = new PointerEvent('pointerdown', {
        ...init,
        button: 0,
        buttons: 1
      })
      const up = new PointerEvent('pointerup', {
        ...init,
        button: 0,
        buttons: 0
      })
      vi.spyOn(down, 'timeStamp', 'get').mockReturnValue(timeStamp)
      vi.spyOn(up, 'timeStamp', 'get').mockReturnValue(timeStamp + 20)
      canvas.processMouseDown(down)
      return () => canvas.processMouseUp(up)
    }

    it('opens no rename prompt when the canvas turns read-only during the second press', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      relayout()
      const release = holdPressAt(canvas, 420, 300, 200)
      canvas.read_only = true
      release()

      expect(prompt).not.toHaveBeenCalled()
    })

    it('opens no rename prompt when the canvas turns read-only during a double click whose first click missed', () => {
      const { canvas, prompt } = createStackFixture()

      pressAt(canvas, 420, 280, 100)
      const release = holdPressAt(canvas, 420, 295, 200)
      canvas.read_only = true
      release()

      expect(prompt).not.toHaveBeenCalled()
    })

    it('collapses without cancelling Rename when Escape is pressed during the second press', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      relayout()
      const release = holdPressAt(canvas, 420, 300, 200)
      canvas.processKey(new KeyboardEvent('keydown', { key: 'Escape' }))
      release()
      relayout()

      expect(prompt).toHaveBeenCalledOnce()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it('renames the whole stack after Escape during a second press on its stable edge', () => {
      const { canvas, links, relayout, submitPrompt, labelOf } =
        createStackFixture([undefined, undefined, undefined])

      pressAt(canvas, 420, 313, 100)
      relayout()
      const release = holdPressAt(canvas, 420, 313, 200)
      canvas.processKey(new KeyboardEvent('keydown', { key: 'Escape' }))
      release()
      submitPrompt('edge')

      expect(links.map(labelOf)).toEqual(['edge', 'edge', 'edge'])
      expect(queryLinkBadgeAtPoint(canvas, 420, 335)).toBeUndefined()
    })

    function dragFromBesideStackAfterClickingIt(gap: number) {
      const previousBehavior = LiteGraph.leftMouseClickBehavior
      LiteGraph.leftMouseClickBehavior = 'select'
      onTestFinished(() => {
        LiteGraph.leftMouseClickBehavior = previousBehavior
      })
      const { canvas, relayout } = createStackFixture()
      pressAt(canvas, 420, 300, 100)
      relayout()

      const init = { isPrimary: true, pointerId: 1, button: 0 }
      const down = new PointerEvent('pointerdown', {
        ...init,
        buttons: 1,
        clientX: 420,
        clientY: 284
      })
      vi.spyOn(down, 'timeStamp', 'get').mockReturnValue(100 + gap)
      canvas.processMouseDown(down)
      canvas.processMouseMove(
        new PointerEvent('pointermove', {
          ...init,
          buttons: 1,
          clientX: 460,
          clientY: 244
        })
      )
      expect(canvas.dragging_rectangle).not.toBeNull()
      const draggingCanvas = canvas.dragging_canvas
      canvas.processMouseUp(
        new PointerEvent('pointerup', {
          ...init,
          buttons: 0,
          clientX: 460,
          clientY: 244
        })
      )
      return { draggingCanvas, offset: [...canvas.ds.offset] }
    }

    it('selects, not pans, when dragging from beside a just-clicked stack', () => {
      const outsideDoubleClickWindow = dragFromBesideStackAfterClickingIt(1000)

      expect(outsideDoubleClickWindow.draggingCanvas).toBe(false)
      expect(dragFromBesideStackAfterClickingIt(100)).toEqual(
        outsideDoubleClickWindow
      )
    })

    it('does not expose a member as the second target during pending expansion', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 309, 100)
      vi.advanceTimersByTime(100)
      relayout()
      pressAt(canvas, 420, 325, 220)
      vi.advanceTimersByTime(600)
      relayout()

      expect(prompt).not.toHaveBeenCalled()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it('keeps the first click collapse when an expanded stack is double clicked and renamed', () => {
      const { canvas, links, relayout, prompt, submitPrompt } =
        createStackFixture()
      pressAt(canvas, 420, 300, 100)
      vi.advanceTimersByTime(300)
      relayout()

      pressAt(canvas, 420, 300, 500)
      relayout()
      pressAt(canvas, 420, 300, 600)
      relayout()

      expect(prompt).toHaveBeenCalledOnce()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()

      submitPrompt('render_size')

      expect(stackedLinkIdsAt(canvas, 420, 300)).toEqual(
        links.map(({ id }) => id)
      )
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
    })

    it('collapses only the renamed stack when its menu Rename clears the name', () => {
      const { canvas, links, relayout, submitPrompt } = createStackFixture([
        'batch',
        'batch',
        'other',
        'other'
      ])
      const menu = vi
        .spyOn(LiteGraph, 'ContextMenu')
        .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
      singleClickAt(canvas, 420, 325)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 350)).toBe(links[2].id)
      singleClickAt(canvas, 420, 300)
      relayout()

      canvas.processContextMenu(
        undefined,
        fromPartial<CanvasPointerEvent>({ canvasX: 420, canvasY: 300 })
      )
      void menu.mock.calls[0][1]?.callback?.({
        content: 'Rename',
        value: 'Rename'
      })
      submitPrompt('')

      expect(stackedLinkIdsAt(canvas, 420, 300)).toEqual(
        links.slice(0, 2).map(({ id }) => id)
      )
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
      expect(queryLinkBadgeAtPoint(canvas, 420, 350)).toBe(links[2].id)
    })

    it('leaves a stack collapsed when the first click of a double click missed it', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 280, 100)
      pressAt(canvas, 420, 295, 200)
      relayout()

      expect(prompt).toHaveBeenCalledOnce()
      expect(queryLinkBadgeAtPoint(canvas, 420, 322)).toBeUndefined()
    })

    it('leaves a stack collapsed when Escape collapsed it between two fast clicks', () => {
      const { canvas, relayout, prompt } = createStackFixture()

      pressAt(canvas, 420, 300, 100)
      canvas.processKey(new KeyboardEvent('keydown', { key: 'Escape' }))
      pressAt(canvas, 420, 300, 200)
      relayout()

      expect(prompt).toHaveBeenCalledOnce()
      expect(queryLinkBadgeAtPoint(canvas, 420, 322)).toBeUndefined()
    })

    it.for([
      { source: undefined, destination: 'batch', submitted: ' batch ' },
      { source: 'batch', destination: undefined, submitted: '' }
    ])(
      'collapses a merge from $source into an expanded $destination stack',
      ({ source, destination, submitted }) => {
        const { canvas, links, relayout, prompt, submitPrompt } =
          createStackFixture([
            source,
            source,
            destination,
            destination,
            'other',
            'other'
          ])
        const other = relayout().get(links[4].id)
        assert.exists(other)
        singleClickAt(canvas, ...other.output.tip)
        const target = relayout().get(links[2].id)
        assert.exists(target)
        singleClickAt(canvas, ...target.output.tip)
        const original = relayout().get(links[0].id)
        assert.exists(original)

        doubleClickAt(canvas, ...original.output.tip)
        expect(prompt.mock.calls[0][1]).toBe(source ?? '')
        submitPrompt(submitted)

        const merged = relayout().get(links[0].id)
        const unrelated = relayout().get(links[4].id)
        assert.exists(merged)
        assert.exists(unrelated)
        expect(stackedLinkIdsAt(canvas, ...merged.output.tip)).toEqual(
          links.slice(0, 4).map(({ id }) => id)
        )
        expect(queryLinkBadgeAtPoint(canvas, ...unrelated.output.tip)).toBe(
          links[4].id
        )
      }
    )

    it('returns every link to the unlabelled stack when a stack name is cleared', () => {
      const { canvas, links, prompt, submitPrompt, labelOf } =
        createStackFixture(['batch', 'batch', undefined])

      doubleClickAt(canvas, 420, 322)
      expect(prompt.mock.calls[0][1]).toBe('batch')
      submitPrompt('')

      expect(links.map(labelOf)).toEqual([undefined, undefined, undefined])
      expect(stackedLinkIdsAt(canvas, 420, 300)).toEqual(
        links.map(({ id }) => id)
      )
    })

    it('renames only one link when its expanded label is double clicked', () => {
      const { canvas, links, relayout, submitPrompt, labelOf } =
        createStackFixture()
      singleClickAt(canvas, 420, 300)
      relayout()

      doubleClickAt(canvas, 420, 325)
      submitPrompt('solo')

      expect(links.map(labelOf)).toEqual(['solo', undefined])
    })

    it('renames the whole stack from the Rename item of its context menu', () => {
      const { canvas, links, relayout, prompt, submitPrompt, labelOf } =
        createStackFixture()
      pressAt(canvas, 420, 300, 100)
      const menu = vi
        .spyOn(LiteGraph, 'ContextMenu')
        .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
      const rightClick = fromPartial<CanvasPointerEvent>({
        canvasX: 420,
        canvasY: 300
      })

      canvas.processContextMenu(undefined, rightClick)

      const [items, options] = menu.mock.calls[0]
      expect(items).toEqual([
        { content: 'Rename', value: 'Rename' },
        { content: 'Show Links', value: 'Show Links' }
      ])
      void options?.callback?.({ content: 'Rename', value: 'Rename' })
      expect(prompt).toHaveBeenCalledWith(
        'Rename',
        '',
        expect.any(Function),
        rightClick
      )
      vi.advanceTimersByTime(600)
      relayout()
      expect(queryLinkBadgeAtPoint(canvas, 420, 325)).toBeUndefined()
      submitPrompt('render_size')

      expect(links.map(labelOf)).toEqual(['render_size', 'render_size'])
    })

    it('shows every link in a stack from the Show Links item of its context menu', () => {
      const { graph, canvas, links } = createStackFixture()
      const menu = vi
        .spyOn(LiteGraph, 'ContextMenu')
        .mockImplementation(fromPartial<typeof LiteGraph.ContextMenu>(class {}))
      const hiddenLinks = () =>
        links.filter(
          ({ id }) =>
            useLinkPresentationStore().getPresentation(graphScopeOf(graph), id)
              ?.hidden
        )

      canvas.processContextMenu(
        undefined,
        fromPartial<CanvasPointerEvent>({ canvasX: 420, canvasY: 300 })
      )
      const callback = menu.mock.calls[0][1]?.callback

      void callback?.(undefined)
      expect(hiddenLinks()).toEqual(links)

      void callback?.({ content: 'Show Links', value: 'Show Links' })
      expect(hiddenLinks()).toEqual([])
    })

    it('collapses an expanded stack when empty canvas is clicked', () => {
      const { canvas, relayout } = createStackFixture()

      singleClickAt(canvas, 420, 300)
      relayout()
      singleClickAt(canvas, 100, 100)
      relayout()

      expect(queryLinkBadgeAtPoint(canvas, 420, 322)).toBeUndefined()
    })
  })
})
