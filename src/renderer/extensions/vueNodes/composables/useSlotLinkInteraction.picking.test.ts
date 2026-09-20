import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { LinkConnectorAdapter } from '@/renderer/core/canvas/links/linkConnectorAdapter'
import { useSlotLinkInteraction } from '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'
import { app } from '@/scripts/app'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))

function createConnectedGraph() {
  const element = document.createElement('canvas')
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  const graph = new LGraph()
  const canvas = new LGraphCanvas(element, graph, {
    skip_events: true,
    skip_render: true
  })
  const source = new LGraphNode('Source')
  source.addOutput('out', 'MODEL')
  graph.add(source)
  const target = new LGraphNode('Target')
  target.addInput('in', 'MODEL')
  graph.add(target)
  source.connect(0, target, 0)
  app.canvas = canvas
  useCanvasStore().canvas = canvas
  return { graph, canvas, source, target }
}

function targetInputInteraction(scope: EffectScope, target: LGraphNode) {
  return scope.run(() =>
    useSlotLinkInteraction({ nodeId: target.id, index: 0, type: 'input' })
  )!
}

describe('useSlotLinkInteraction while picking nodes for the agent', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
  })

  afterEach(() => scope.stop())

  it.for([
    {
      picking: false,
      modifiers: {},
      linkKept: true,
      dragsStarted: 1
    },
    {
      picking: true,
      modifiers: {},
      linkKept: true,
      dragsStarted: 0
    },
    {
      picking: false,
      modifiers: { ctrlKey: true, altKey: true },
      linkKept: false,
      dragsStarted: 1
    },
    {
      picking: true,
      modifiers: { ctrlKey: true, altKey: true },
      linkKept: true,
      dragsStarted: 0
    }
  ])(
    'picking=$picking pointerdown with $modifiers on a connected input keeps the link: $linkKept, starts $dragsStarted link drags',
    ({ picking, modifiers, linkKept, dragsStarted }) => {
      useAgentNodeSelectionStore().isActive = picking
      const { target } = createConnectedGraph()
      const beginFromInput = vi.spyOn(
        LinkConnectorAdapter.prototype,
        'beginFromInput'
      )
      const { onPointerDown } = targetInputInteraction(scope, target)

      onPointerDown(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 1,
          ...modifiers
        })
      )

      expect(target.inputs[0].link != null).toBe(linkKept)
      expect(beginFromInput).toHaveBeenCalledTimes(dragsStarted)
    }
  )

  it.for([
    { picking: false, clicks: 1, doubleClicks: 1 },
    { picking: true, clicks: 0, doubleClicks: 0 }
  ])(
    'picking=$picking forwards $clicks slot clicks and $doubleClicks slot double clicks to the node',
    ({ picking, clicks, doubleClicks }) => {
      useAgentNodeSelectionStore().isActive = picking
      const { target } = createConnectedGraph()
      target.onInputClick = vi.fn()
      target.onInputDblClick = vi.fn()
      const { onClick, onDoubleClick } = targetInputInteraction(scope, target)

      onClick(new PointerEvent('click', { button: 0, pointerId: 1 }))
      onDoubleClick(new PointerEvent('dblclick', { button: 0, pointerId: 1 }))

      expect(target.onInputClick).toHaveBeenCalledTimes(clicks)
      expect(target.onInputDblClick).toHaveBeenCalledTimes(doubleClicks)
    }
  )

  it.for([
    { pickingMidDrag: false, tracksPointer: true, drops: 1 },
    { pickingMidDrag: true, tracksPointer: false, drops: 0 }
  ])(
    'a drag started while editable with picking begun mid-drag=$pickingMidDrag tracks the pointer: $tracksPointer and drops on the canvas $drops times',
    ({ pickingMidDrag, tracksPointer, drops }) => {
      useAgentNodeSelectionStore().isActive = false
      const { canvas, target } = createConnectedGraph()
      const dropOnCanvas = vi
        .spyOn(LinkConnectorAdapter.prototype, 'dropOnCanvas')
        .mockImplementation(() => {})
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(canvas.canvas)
      const { onPointerDown } = targetInputInteraction(scope, target)

      onPointerDown(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 1,
          clientX: 10,
          clientY: 10
        })
      )
      const mouseBeforeMove = [...canvas.last_mouse]
      useAgentNodeSelectionStore().isActive = pickingMidDrag
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 40,
          clientY: 50
        })
      )
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          button: 0,
          pointerId: 1,
          clientX: 40,
          clientY: 50
        })
      )

      expect([...canvas.last_mouse]).toEqual(
        tracksPointer ? [40, 50] : mouseBeforeMove
      )
      expect(dropOnCanvas).toHaveBeenCalledTimes(drops)
    }
  )
})
