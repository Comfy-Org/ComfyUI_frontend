import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import WidgetDOM from './WidgetDOM.vue'
import WidgetLegacy from './WidgetLegacy.vue'

vi.mock(import('@/scripts/app'))

function ownerAndRenderedDecoy() {
  const interior = createTestSubgraph()
  const root = interior.rootGraph
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(root)
  const owner = new LGraphNode('Owner')
  root.add(owner)
  const decoy = new LGraphNode('Decoy')
  interior.add(decoy)
  stubCanvasGetContext()
  const canvas = new LGraphCanvas(document.createElement('canvas'), interior, {
    skip_render: true,
    skip_events: true
  })
  useCanvasStore().canvas = canvas
  useCanvasStore().currentGraph = interior
  return { owner, decoy }
}

function domWidget(node: LGraphNode, value: string) {
  const element = document.createElement('input')
  element.setAttribute('aria-label', 'Custom value')
  element.value = value
  const widget = node.addCustomWidget<
    IBaseWidget & { element: HTMLInputElement }
  >({
    name: 'value',
    type: 'owner-test-dom',
    value,
    y: 0,
    options: {},
    element
  })
  element.addEventListener('input', () => {
    widget.value = element.value
  })
  return widget
}

function legacyWidget(node: LGraphNode, editedValue: number) {
  const widget = node.addCustomWidget<IBaseWidget>({
    name: 'value',
    type: 'owner-test-legacy',
    value: 1,
    y: 0,
    options: {},
    draw() {},
    mouse() {
      widget.value = editedValue
      return true
    }
  })
  return widget
}

function hostedWidgetProps(
  owner: LGraphNode,
  renderedNode: LGraphNode,
  type: string
) {
  return {
    nodeId: renderedNode.id,
    widget: {
      name: 'value',
      type,
      value: undefined,
      hostNodeLocatorId: createNodeLocatorId(null, owner.id)
    }
  }
}

describe('off-graph widget ownership', () => {
  it('edits the DOM widget of the located owner, not the rendered node on the canvas graph', async () => {
    const { owner, decoy } = ownerAndRenderedDecoy()
    const owned = domWidget(owner, 'owned')
    const shadowed = domWidget(decoy, 'shadowed')
    render(WidgetDOM, {
      props: hostedWidgetProps(owner, decoy, 'owner-test-dom')
    })
    const user = userEvent.setup()
    const textbox = screen.getByRole('textbox', { name: 'Custom value' })

    await user.clear(textbox)
    await user.type(textbox, 'A')

    expect([owned.value, shadowed.value]).toEqual(['A', 'shadowed'])
  })

  it('sends legacy pointer edits to the located owner, not the rendered node on the canvas graph', async () => {
    const { owner, decoy } = ownerAndRenderedDecoy()
    const owned = legacyWidget(owner, 17)
    const shadowed = legacyWidget(decoy, 29)
    render(WidgetLegacy, {
      props: hostedWidgetProps(owner, decoy, 'owner-test-legacy')
    })

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: screen.getByTestId('legacy-widget-canvas'),
      coords: { offsetX: 28, offsetY: 11 }
    })

    expect([owned.value, shadowed.value]).toEqual([17, 1])
  })
})
