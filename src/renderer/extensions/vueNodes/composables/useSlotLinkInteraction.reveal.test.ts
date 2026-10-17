import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  useCanvasPositionConversion,
  useSharedCanvasPositionConversion
} from '@/composables/element/useCanvasPositionConversion'
import {
  clearRootLinkReveals,
  isLinkRevealed
} from '@/lib/litegraph/src/canvas/linkRevealState'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas,
  createTestLink
} from '@/utils/__tests__/litegraphTestUtils'

import {
  isRerouteVisibleForLinkDrag,
  useSlotLinkInteraction
} from './useSlotLinkInteraction'
import { useSlotLinkReveal } from './useSlotLinkReveal'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/composables/element/useCanvasPositionConversion'), {
  spy: true
})

function createFixture() {
  const graph = new LGraph()
  const ctx = createMockCanvasRenderingContext2D()
  const canvas = createTestCanvas(graph, ctx)
  const canvasStore = useCanvasStore()
  canvasStore.canvas = canvas
  vi.spyOn(app, 'canvas', 'get').mockReturnValue(canvas)
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)
  const scope = effectScope()
  const converter = scope.run(() =>
    useCanvasPositionConversion(canvas.canvas, canvas)
  )
  assert.exists(converter)
  vi.mocked(useSharedCanvasPositionConversion).mockReturnValue(converter)
  const [source, target, otherSource, otherTarget] = [0, 1, 2, 3].map((i) => {
    const node = new LGraphNode(`Node ${i}`)
    node.addInput('in', 'MODEL')
    node.addOutput('out', 'MODEL')
    graph.add(node)
    node.pos = [100 + i * 250, 200]
    node.updateArea(ctx)
    return node
  })
  const link = createTestLink(graph, source, 0, target, 0)
  const otherLink = createTestLink(graph, otherSource, 0, otherTarget, 0)
  const graphScope = graphScopeOf(graph)
  useLinkPresentationStore().patch(graphScope, link.id, { hidden: true })
  useLinkPresentationStore().patch(graphScope, otherLink.id, { hidden: true })
  onTestFinished(() => {
    scope.stop()
    canvas.linkConnector.reset()
    useSlotLinkDragUIState().endDrag()
    clearRootLinkReveals(graphScope.rootGraphId)
    canvas.unbindEvents()
    canvasStore.canvas = null
  })

  function slot(node: LGraphNode, type: 'input' | 'output' = 'output') {
    const slotScope = effectScope()
    onTestFinished(() => slotScope.stop())
    const options = { nodeId: node.id, index: 0, type }
    const handlers = slotScope.run(() => ({
      ...useSlotLinkInteraction(options),
      ...useSlotLinkReveal(options)
    }))
    assert.exists(handlers)
    const { onPointerDown } = handlers
    function down(pointerId = 1, modifiers: PointerEventInit = {}) {
      onPointerDown(
        new PointerEvent('pointerdown', {
          pointerId,
          button: 0,
          clientX: 400,
          clientY: 300,
          ...modifiers
        })
      )
    }
    return { ...handlers, down, stop: () => slotScope.stop() }
  }
  return {
    graph,
    canvas,
    source,
    target,
    otherSource,
    otherTarget,
    link,
    otherLink,
    graphScope,
    slot
  }
}

function finish(type: 'pointerup' | 'pointercancel') {
  window.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      button: 0,
      clientX: 400,
      clientY: 300
    })
  )
}

describe('hidden link visibility during slot drags', () => {
  it.for(['input', 'output'] as const)(
    'keeps a hidden reroute available after leaving the %s slot',
    (type) => {
      const f = createFixture()
      const reroute = f.graph.createReroute([250, 200], f.link)
      assert.exists(reroute)
      const slot = f.slot({ input: f.target, output: f.source }[type], type)
      slot.revealLinks()
      slot.down()
      slot.unrevealLinks()

      expect(isRerouteVisibleForLinkDrag(f.graph, reroute)).toBe(true)
    }
  )

  it.for(['pointerup', 'pointercancel', 'dispose'] as const)(
    'releases the drag reveal on %s',
    async (ending) => {
      const f = createFixture()
      const slot = f.slot(f.source)
      slot.revealLinks()
      slot.down()
      slot.unrevealLinks()
      expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(true)
      await nextTick()
      const endings = {
        pointerup: () => finish('pointerup'),
        pointercancel: () => finish('pointercancel'),
        dispose: slot.stop
      }
      endings[ending]()

      expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(false)
    }
  )

  it('preserves the drag reveal across another hover and preserves that hover on completion', async () => {
    const f = createFixture()
    const source = f.slot(f.source)
    const other = f.slot(f.otherSource)
    source.down()
    other.revealLinks()
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(true)
    await nextTick()
    finish('pointerup')

    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(false)
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.otherLink.id)).toBe(true)
  })

  it('does not replace the drag reveal when the connector rejects another start', () => {
    const f = createFixture()
    f.slot(f.source).down(1)
    f.slot(f.otherSource).down(2)

    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(true)
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.otherLink.id)).toBe(false)
  })

  it.for(['input', 'output'] as const)(
    'preserves the %s disconnect shortcut during another drag',
    (type) => {
      const f = createFixture()
      f.slot(f.source).down(1)
      f.slot({ input: f.otherTarget, output: f.otherSource }[type], type).down(
        2,
        { ctrlKey: true, altKey: true }
      )

      expect(f.graph.getLink(f.otherLink.id)).toBeUndefined()
    }
  )

  it('does not retain a reveal when an extension cancels the drag start', () => {
    const f = createFixture()
    f.canvas.linkConnector.events.addEventListener(
      'before-move-input',
      (event) => event.preventDefault(),
      { once: true }
    )
    const slot = f.slot(f.target, 'input')
    slot.revealLinks()
    slot.down()
    slot.unrevealLinks()

    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(false)
  })

  it('clears the drag reveal when the graph is reset', () => {
    const f = createFixture()
    f.slot(f.source).down()
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(true)
    f.canvas.setGraph(f.graph)

    expect(isLinkRevealed(f.graphScope.rootGraphId, f.link.id)).toBe(false)
  })
})
