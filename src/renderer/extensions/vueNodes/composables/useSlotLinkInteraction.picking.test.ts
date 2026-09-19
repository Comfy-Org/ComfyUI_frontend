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
      const { onPointerDown } = scope.run(() =>
        useSlotLinkInteraction({ nodeId: target.id, index: 0, type: 'input' })
      )!

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
})
