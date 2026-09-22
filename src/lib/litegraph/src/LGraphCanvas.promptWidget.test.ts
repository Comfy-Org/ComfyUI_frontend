import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph,
  SubgraphNode,
  createUuidv4
} from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  createTestSubgraphData,
  registerTestSubgraphNodeTypes
} from './subgraph/__fixtures__/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

const INTERIOR_TYPE = 'test/prompt-interior'

/** Mirrors the app's INT callback: a plain function using widget `this`. */
function onValueChange(this: INumericWidget, v: number) {
  const step = this.options.step2 || 1
  this.value = Math.round(v / step) * step
}

class InteriorNode extends LGraphNode {
  constructor() {
    super('Prompt Interior')
    this.serialize_widgets = true
    const seedSlot = this.addInput('seed', 'NUMBER')
    seedSlot.widget = { name: 'seed' }
    this.addOutput('out', 'NUMBER')
    this.addWidget('number', 'seed', 42, onValueChange, {
      step2: 1,
      precision: 0
    })
  }
}

const canvases: LGraphCanvas[] = []

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600
  el.getContext = vi.fn().mockReturnValue(createMockCanvasRenderingContext2D())
  el.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  document.body.append(el)
  const canvas = new LGraphCanvas(el, graph, { skip_render: true })
  canvases.push(canvas)
  return canvas
}

function centerClickEvent(node: LGraphNode) {
  return {
    canvasX: node.pos[0] + node.size[0] / 2,
    canvasY: node.pos[1] + 40,
    clientX: node.pos[0] + node.size[0] / 2,
    clientY: node.pos[1] + 40
  }
}

describe('prompt dialog opened from a promoted widget', () => {
  let host: SubgraphNode

  beforeEach(() => {
    LiteGraph.registerNodeType(INTERIOR_TYPE, InteriorNode)
  })

  afterEach(() => {
    LiteGraph.unregisterNodeType(INTERIOR_TYPE)
    document.body.innerHTML = ''
    for (const canvas of canvases.splice(0)) {
      canvas.unbindEvents()
      canvas.canvas.remove()
    }
  })

  it('closes on Enter after committing the value', () => {
    const rootGraph = new LGraph()
    rootGraph.id = createUuidv4()
    registerTestSubgraphNodeTypes(rootGraph)
    const canvas = createCanvas(rootGraph)
    LGraphCanvas.active_canvas = canvas

    const subgraph = rootGraph.createSubgraph(
      createTestSubgraphData({ name: 'Prompt Subgraph' })
    )

    const interior = LiteGraph.createNode(INTERIOR_TYPE)!
    subgraph.add(interior)
    subgraph.addInput('seed', 'NUMBER').connect(interior.inputs[0], interior)
    subgraph.addOutput('out', 'NUMBER')
    subgraph.outputNode.slots[0].connect(interior.outputs[0], interior)

    host = LiteGraph.createNode(subgraph.id) as SubgraphNode
    expect(host).toBeInstanceOf(SubgraphNode)
    rootGraph.add(host)
    host.pos = [100, 100]

    expect(
      promoteValueWidgetViaSubgraphInput(host, interior, interior.widgets![0])
    ).toStrictEqual({ ok: true })

    const widget = host.getWidgetFromSlot(host.inputs[0])
    expect(widget).toBeDefined()

    const e = centerClickEvent(host)
    canvas.processWidgetClick(e as never, host, widget!)
    canvas.pointer.onClick?.(e as never)

    const dialog = document.querySelector('.graphdialog')
    expect(dialog).toBeTruthy()

    const input = dialog!.querySelector('input.value') as HTMLInputElement
    input.value = '123.4'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(dialog!.parentNode).toBeNull()
    expect(
      useWidgetValueStore().getWidget(host.inputs[0].widgetId!)!.value
    ).toBe(123)
    expect(interior.widgets![0].value).toBe(123)
  })
})
