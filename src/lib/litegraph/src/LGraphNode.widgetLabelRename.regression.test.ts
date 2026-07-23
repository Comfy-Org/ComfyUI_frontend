import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { renameWidget } from '@/utils/widgetUtil'

/**
 * Mimics a normal core node (e.g. CLIPTextEncode): a `text` widget backed by a
 * plain input slot whose `widget.name` matches the widget. A normal-node input
 * never receives a `widgetId` (only subgraph/promotion inputs do), which is the
 * precondition that triggered the `renameWidget` lookup bug.
 */
class ClipTextEncodeLikeNode extends LGraphNode {
  static override title = 'CLIPTextEncodeLike'
  constructor() {
    super('CLIPTextEncodeLike')
    this.serialize_widgets = true
    this.addWidget('text', 'text', 'a cat', null)
    const input = this.addInput('text', 'STRING')
    input.widget = { name: 'text' }
  }
}

LiteGraph.registerNodeType('test/CLIPTextEncodeLike', ClipTextEncodeLikeNode)

/**
 * Regression #13861: a renamed widget label reverted to its default on
 * save/reload, delete/undo, and copy/paste for normal (input-backed) nodes.
 *
 * Root cause: `renameWidget` looked up the backing input by `widgetId` whenever
 * the widget had one (true for every in-graph widget), but normal-node inputs
 * carry no `widgetId`, so the lookup found nothing and never wrote `input.label`
 * — the channel the label round-trips through. These tests drive the real
 * `renameWidget` (never hand-setting `widget.label`) and assert the label
 * survives a real serialize -> configure round-trip.
 */
describe('renameWidget label persistence via input lookup (regression #13861)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14,
      isValidConnection: vi.fn().mockReturnValue(true)
    })
  })

  function addClipNode(graph: LGraph): LGraphNode {
    const node = LiteGraph.createNode('test/CLIPTextEncodeLike')!
    graph.add(node)
    return node
  }

  function createCanvas(graph: LGraph): LGraphCanvas {
    const el = document.createElement('canvas')
    el.width = 800
    el.height = 600
    el.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    el.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
    return new LGraphCanvas(el, graph, { skip_render: true })
  }

  test('renameWidget writes the label onto the normal-node backing input', () => {
    const graph = new LGraph()
    const node = addClipNode(graph)
    const widget = node.widgets![0]
    const input = node.inputs![0]

    // Preconditions that reproduced the bug: the in-graph widget has a truthy
    // widgetId, but the normal-node input carries none.
    expect(widget.widgetId).toBeTruthy()
    expect(input.widgetId).toBeUndefined()
    expect(input.widget?.name).toBe('text')

    renameWidget(widget, node, 'Positive Prompt')

    expect(input.label).toBe('Positive Prompt')
  })

  test('label survives a full graph serialize -> configure round-trip', () => {
    const graph = new LGraph()
    const node = addClipNode(graph)
    renameWidget(node.widgets![0], node, 'Positive Prompt')

    const restored = new LGraph()
    restored.configure(graph.serialize())

    const restoredNode = restored.getNodeById(node.id)!
    expect(restoredNode.widgets![0].label).toBe('Positive Prompt')
  })

  test('label survives delete -> undo', () => {
    const graph = new LGraph()
    const node = addClipNode(graph)
    renameWidget(node.widgets![0], node, 'Positive Prompt')

    const undoSnapshot = graph.serialize()
    graph.remove(node)
    expect(graph.getNodeById(node.id)).toBeFalsy()

    const restored = new LGraph()
    restored.configure(undoSnapshot)

    expect(restored.getNodeById(node.id)!.widgets![0].label).toBe(
      'Positive Prompt'
    )
  })

  test('clearing a rename reverts the label to its default after round-trip', () => {
    const graph = new LGraph()
    const node = addClipNode(graph)
    renameWidget(node.widgets![0], node, 'Positive Prompt')
    renameWidget(node.widgets![0], node, '')

    expect(node.inputs![0].label).toBeUndefined()

    const restored = new LGraph()
    restored.configure(graph.serialize())

    expect(restored.getNodeById(node.id)!.widgets![0].label).toBeUndefined()
  })

  test('label survives copy -> paste', () => {
    const graph = new LGraph()
    const canvas = createCanvas(graph)
    const node = addClipNode(graph)
    renameWidget(node.widgets![0], node, 'Positive Prompt')

    const pasted = canvas._deserializeItems(canvas._serializeItems([node]), {
      position: [50, 50]
    })!

    const pastedNode = [...pasted.nodes.values()][0]
    expect(pastedNode.widgets![0].label).toBe('Positive Prompt')
  })
})
