import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  clearRootLinkReveals,
  isLinkRevealed
} from '@/lib/litegraph/src/canvas/linkRevealState'
import {
  useCanvasPositionConversion,
  useSharedCanvasPositionConversion
} from '@/composables/element/useCanvasPositionConversion'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toCanvasPointerEvent } from '@/renderer/core/canvas/interaction/canvasPointerEvent'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { app } from '@/scripts/app'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas,
  createTestLink
} from '@/utils/__tests__/litegraphTestUtils'
import { useSlotLinkInteraction } from './useSlotLinkInteraction'

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
  const nodes = [
    'source A',
    'target A',
    'source B',
    'target B',
    'destination'
  ].map((title, index) => {
    const node = new LGraphNode(title)
    node.addInput('in', 'MODEL')
    node.addOutput('out', 'MODEL')
    graph.add(node)
    node.pos = [100 + index * 250, 200]
    node.updateArea(ctx)
    return node
  })
  const [sourceA, targetA, sourceB, targetB, destination] = nodes
  const firstLink = createTestLink(graph, sourceA, 0, targetA, 0)
  const secondLink = createTestLink(graph, sourceB, 0, targetB, 0)
  const graphScope = graphScopeOf(graph)
  useLinkPresentationStore().patch(graphScope, firstLink.id, { hidden: true })
  useLinkPresentationStore().patch(graphScope, secondLink.id, { hidden: true })
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
    const handlers = slotScope.run(() =>
      useSlotLinkInteraction({ nodeId: node.id, index: 0, type })
    )
    assert.exists(handlers)
    const element = document.createElement('div')
    element.className = 'lg-slot'
    const button = document.createElement('button')
    button.dataset.slotKey = getSlotKey(node.id, 0, type === 'input')
    element.append(button)
    document.body.append(element)
    button.addEventListener('pointerdown', handlers.onPointerDown)
    function down(pointerId: number, modifiers: PointerEventInit = {}) {
      const event = new PointerEvent('pointerdown', {
        pointerId,
        button: 0,
        clientX: 400,
        clientY: 300,
        bubbles: true,
        cancelable: true,
        ...modifiers
      })
      button.dispatchEvent(event)
      return event
    }
    return { down, stop: () => slotScope.stop(), button }
  }
  return {
    graph,
    canvas,
    sourceA,
    targetA,
    sourceB,
    targetB,
    destination,
    firstLink,
    secondLink,
    graphScope,
    slot
  }
}

function finish(
  type: 'pointerup' | 'pointercancel',
  pointerId: number,
  target: EventTarget = window
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId,
      button: 0,
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true
    })
  )
}

describe('slot drag ownership', () => {
  it('keeps the first reveal and source when another pointer starts', async () => {
    const f = createFixture()
    const first = f.slot(f.sourceA)
    const second = f.slot(f.sourceB)
    first.down(11)
    await nextTick()
    second.down(22)

    expect(isLinkRevealed(f.graphScope.rootGraphId, f.firstLink.id)).toBe(true)
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.secondLink.id)).toBe(
      false
    )
    expect(useSlotLinkDragUIState().state.source?.nodeId).toBe(f.sourceA.id)
    expect(useSlotLinkDragUIState().state.pointerId).toBe(11)
  })

  it.for(['pointerup', 'pointercancel', 'dispose'] as const)(
    'preserves the first connection after a rejected pointer ends by %s',
    async (ending) => {
      const f = createFixture()
      const first = f.slot(f.sourceA)
      const second = f.slot(f.sourceB)
      const destination = f.slot(f.destination, 'input')
      first.down(11)
      await nextTick()
      second.down(22)
      await nextTick()
      const endings = {
        pointerup: () => finish('pointerup', 22),
        pointercancel: () => finish('pointercancel', 22),
        dispose: second.stop
      }
      endings[ending]()

      expect(f.canvas.linkConnector.isConnecting).toBe(true)
      expect(useSlotLinkDragUIState().state.pointerId).toBe(11)
      finish('pointerup', 11, destination.button)
      const link = f.graph.getLink(f.destination.inputs[0].link)
      expect(link?.origin_id).toBe(f.sourceA.id)
    }
  )

  it.for(['pointerup', 'pointercancel', 'dispose'] as const)(
    'allows a new drag after the owner ends by %s',
    async (ending) => {
      const f = createFixture()
      const first = f.slot(f.sourceA)
      const second = f.slot(f.sourceB)
      first.down(11)
      await nextTick()
      const endings = {
        pointerup: () => finish('pointerup', 11),
        pointercancel: () => finish('pointercancel', 11),
        dispose: first.stop
      }
      endings[ending]()
      expect(f.canvas.linkConnector.isConnecting).toBe(false)
      expect(isLinkRevealed(f.graphScope.rootGraphId, f.firstLink.id)).toBe(
        false
      )

      second.down(22)
      expect(f.canvas.linkConnector.isConnecting).toBe(true)
      expect(useSlotLinkDragUIState().state.source?.nodeId).toBe(f.sourceB.id)
      expect(isLinkRevealed(f.graphScope.rootGraphId, f.secondLink.id)).toBe(
        true
      )
    }
  )

  it('consumes a rejected pointerdown without bubbling to the canvas parent', async () => {
    const f = createFixture()
    const first = f.slot(f.sourceA)
    const second = f.slot(f.sourceB)
    const propagated = vi.fn()
    document.body.addEventListener('pointerdown', propagated)
    onTestFinished(() =>
      document.body.removeEventListener('pointerdown', propagated)
    )
    first.down(11)
    await nextTick()
    const event = second.down(22)
    expect(event.defaultPrevented).toBe(true)
    expect(propagated).not.toHaveBeenCalled()
  })

  it.for(['input', 'output'] as const)(
    'protects links from a second pointer using the %s disconnect shortcut',
    async (type) => {
      const f = createFixture()
      const first = f.slot(f.sourceA)
      const node = { input: f.targetB, output: f.sourceB }[type]
      const second = f.slot(node, type)
      first.down(11)
      await nextTick()
      second.down(22, { ctrlKey: true, altKey: true })
      expect(f.graph.getLink(f.secondLink.id)).toBeDefined()
      expect(f.canvas.linkConnector.isConnecting).toBe(true)
    }
  )

  it.for([
    {
      name: 'input reconnect',
      type: 'input',
      modifiers: {},
      removed: false,
      connecting: true
    },
    {
      name: 'shift output move',
      type: 'output',
      modifiers: { shiftKey: true },
      removed: false,
      connecting: true
    },
    {
      name: 'ctrl-alt input',
      type: 'input',
      modifiers: { ctrlKey: true, altKey: true },
      removed: true,
      connecting: true
    },
    {
      name: 'meta-alt input',
      type: 'input',
      modifiers: { metaKey: true, altKey: true },
      removed: true,
      connecting: true
    },
    {
      name: 'ctrl-alt output',
      type: 'output',
      modifiers: { ctrlKey: true, altKey: true },
      removed: true,
      connecting: false
    },
    {
      name: 'meta-alt output',
      type: 'output',
      modifiers: { metaKey: true, altKey: true },
      removed: true,
      connecting: false
    }
  ] satisfies {
    name: string
    type: 'input' | 'output'
    modifiers: PointerEventInit
    removed: boolean
    connecting: boolean
  }[])(
    'preserves idle $name behavior',
    ({ type, modifiers, removed, connecting }) => {
      const f = createFixture()
      const node = { input: f.targetA, output: f.sourceA }[type]
      f.slot(node, type).down(11, modifiers)
      expect(f.graph.getLink(f.firstLink.id) === undefined).toBe(removed)
      expect(f.canvas.linkConnector.isConnecting).toBe(connecting)
    }
  )

  it.for(['canvas', 'reroute'] as const)(
    'keeps a %s-origin connection droppable after rejecting a slot gesture',
    async (origin) => {
      const f = createFixture()
      const reroute = f.graph.createReroute([300, 200], f.firstLink)
      assert.exists(reroute)
      const connector = f.canvas.linkConnector
      const starts = {
        canvas: () =>
          connector.dragNewFromOutput(f.graph, f.sourceA, f.sourceA.outputs[0]),
        reroute: () => connector.dragFromReroute(f.graph, reroute)
      }
      starts[origin]()
      const second = f.slot(f.sourceB)
      second.down(22)
      await nextTick()
      second.stop()
      expect(connector.isConnecting).toBe(true)
      const [clientX, clientY] = f.destination.getConnectionPos(true, 0)
      connector.dropLinks(
        f.graph,
        toCanvasPointerEvent(
          new PointerEvent('pointerup', { pointerId: 11, clientX, clientY })
        )
      )
      const link = f.graph.getLink(f.destination.inputs[0].link)
      expect(link?.origin_id).toBe(f.sourceA.id)
    }
  )
})

describe('drag transition compatibility', () => {
  it.for(['input', 'output'] as const)(
    'moves the existing %s endpoint to the new slot',
    async (type) => {
      const f = createFixture()
      const node = { input: f.targetA, output: f.sourceA }[type]
      const source = f.slot(node, type)
      const destination = f.slot(f.destination, type)
      source.down(11, { shiftKey: type === 'output' })
      await nextTick()
      finish('pointerup', 11, destination.button)
      const connections = [...f.graph.links.values()].map((link) => [
        link.origin_id,
        link.target_id
      ])
      const expected = {
        input: [f.sourceA.id, f.destination.id],
        output: [f.destination.id, f.targetA.id]
      }[type]
      expect(connections).toContainEqual(expected)
      expect(connections).not.toContainEqual([f.sourceA.id, f.targetA.id])
    }
  )

  it('does not take over a connector retained by a reset listener and recovers after release', async () => {
    const f = createFixture()
    const first = f.slot(f.sourceA)
    const second = f.slot(f.sourceB)
    first.down(11)
    await nextTick()
    f.canvas.linkConnector.events.addEventListener(
      'reset',
      (event) => event.preventDefault(),
      { once: true }
    )
    finish('pointercancel', 11)
    expect(f.canvas.linkConnector.isConnecting).toBe(true)
    expect(useSlotLinkDragUIState().state.active).toBe(false)

    second.down(22)
    expect(useSlotLinkDragUIState().state.active).toBe(false)
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.secondLink.id)).toBe(
      false
    )

    f.canvas.linkConnector.reset()
    second.down(22)
    expect(useSlotLinkDragUIState().state.source?.nodeId).toBe(f.sourceB.id)
    expect(isLinkRevealed(f.graphScope.rootGraphId, f.secondLink.id)).toBe(true)
  })
})
