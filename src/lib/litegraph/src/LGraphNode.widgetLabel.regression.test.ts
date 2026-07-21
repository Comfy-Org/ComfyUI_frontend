import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

class WidgetLabelTestNode extends LGraphNode {
  static override title = 'WidgetLabelTestNode'
  constructor() {
    super('WidgetLabelTestNode')
    this.serialize_widgets = true
    this.addWidget('text', 'my_widget', 'v', null)
  }
}

LiteGraph.registerNodeType('test/WidgetLabelTestNode', WidgetLabelTestNode)

/**
 * Mimics the rename flow (`renameWidget`): a rename writes both the display
 * `label` and the `userLabel` signal that serialization keys off. Dynamic /
 * localized label code only writes `label`, never `userLabel`.
 */
function rename(widget: IBaseWidget, label: string): void {
  widget.label = label
  widget.userLabel = label
}

/**
 * Regression: renamed widget labels were lost after node delete + undo and
 * copy-paste. `serialize()` persisted only `widgets_values`, and `configure()`
 * restored the rename solely from the `input.label` mirror, which does not
 * exist for socketless / DOM widgets. Undo's clearGraph wiped the live store
 * label, so on re-configure the label was gone.
 *
 * Fix: #13861 — persist socketless widget renames (`userLabel`) through
 * serialize/configure, without leaking localized default display labels.
 */
describe('LGraphNode widget label persistence (regression #13861)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14,
      isValidConnection: vi.fn().mockReturnValue(true)
    })
  })

  function makeNodeWithRenamedWidget(): LGraphNode {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('text', 'my_widget', 'v', null)
    rename(node.widgets![0], 'Renamed Label')
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

  test('serialize persists a socketless widget rename', () => {
    const serialized = makeNodeWithRenamedWidget().serialize()

    expect(serialized.widgets_labels).toEqual({ my_widget: 'Renamed Label' })
  })

  test('does not serialize a localized display label that was never renamed', () => {
    // Widgets receive a locale-dependent display label at creation. Without a
    // rename there is no `userLabel`, so nothing is persisted — otherwise a
    // workflow saved under different locales would differ.
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('text', 'my_widget', 'v', null)
    node.widgets![0].label = 'Localized Display Label'

    expect(node.serialize().widgets_labels).toBeUndefined()
  })

  test('configure restores a socketless widget label after the store is cleared', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('text', 'my_widget', 'v', null)

    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: ['v'],
      widgets_labels: { my_widget: 'Renamed Label' }
    } as ISerialisedNode)

    expect(node.widgets![0].label).toBe('Renamed Label')
  })

  test('label survives a full serialize -> configure round-trip', () => {
    const serialized = makeNodeWithRenamedWidget().serialize()

    const restored = new LGraphNode('TestNode')
    restored.serialize_widgets = true
    restored.addWidget('text', 'my_widget', 'v', null)
    restored.configure(serialized)

    expect(restored.widgets![0].label).toBe('Renamed Label')
  })

  test('input.label mirror takes precedence over widgets_labels', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('number', 'seed', 0, null)
    const input = node.addInput('seed', 'INT')
    input.widget = { name: 'seed' }

    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        {
          name: 'seed',
          type: 'INT',
          link: null,
          label: 'From Input',
          widget: { name: 'seed' }
        }
      ],
      widgets_values: [0],
      widgets_labels: { seed: 'From Labels' }
    } as unknown as ISerialisedNode)

    expect(node.widgets![0].label).toBe('From Input')
  })

  test('input-backed widget renames are not duplicated into widgets_labels', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('number', 'seed', 0, null)
    const input = node.addInput('seed', 'INT')
    input.widget = { name: 'seed' }
    input.label = 'From Input'
    rename(node.widgets![0], 'From Input')

    expect(node.serialize().widgets_labels).toBeUndefined()
  })

  test('label survives the full graph serialize -> configure path (undo/save)', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/WidgetLabelTestNode')!
    graph.add(node)
    rename(node.widgets![0], 'Renamed Label')

    const restored = new LGraph()
    restored.configure(graph.serialize())

    const restoredNode = restored.getNodeById(node.id)!
    expect(restoredNode.widgets![0].label).toBe('Renamed Label')
  })

  test('label survives delete -> undo (serialize snapshot -> reconfigure into a fresh graph)', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/WidgetLabelTestNode')!
    graph.add(node)
    rename(node.widgets![0], 'Renamed Label')

    // changeTracker captures an undo snapshot via serialize; deleting the node
    // and undoing restores it by re-configuring that snapshot into a fresh graph.
    const undoSnapshot = graph.serialize()
    graph.remove(node)
    expect(graph.getNodeById(node.id)).toBeFalsy()

    const restored = new LGraph()
    restored.configure(undoSnapshot)

    expect(restored.getNodeById(node.id)!.widgets![0].label).toBe(
      'Renamed Label'
    )
  })

  test('label survives copy -> paste (canvas clipboard round-trip)', () => {
    const graph = new LGraph()
    const canvas = createCanvas(graph)
    const node = LiteGraph.createNode('test/WidgetLabelTestNode')!
    graph.add(node)
    rename(node.widgets![0], 'Renamed Label')

    const pasted = canvas._deserializeItems(canvas._serializeItems([node]), {
      position: [50, 50]
    })!

    const pastedNode = [...pasted.nodes.values()][0]
    expect(pastedNode.widgets![0].label).toBe('Renamed Label')
  })

  test('a restored rename re-serializes (userLabel round-trips)', () => {
    const restored = new LGraphNode('TestNode')
    restored.serialize_widgets = true
    restored.addWidget('text', 'my_widget', 'v', null)
    restored.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: ['v'],
      widgets_labels: { my_widget: 'Renamed Label' }
    } as ISerialisedNode)

    expect(restored.serialize().widgets_labels).toEqual({
      my_widget: 'Renamed Label'
    })
  })

  test('a widget named __proto__ round-trips as data (no prototype pollution)', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('text', '__proto__', 'v', null)
    rename(node.widgets![0], 'Renamed Label')

    const serialized = node.serialize()
    expect(Object.getPrototypeOf(serialized.widgets_labels)).toBeNull()
    expect(serialized.widgets_labels!['__proto__']).toBe('Renamed Label')

    const restored = new LGraphNode('TestNode')
    restored.serialize_widgets = true
    restored.addWidget('text', '__proto__', 'v', null)
    restored.configure(
      JSON.parse(JSON.stringify(serialized)) as ISerialisedNode
    )

    expect(restored.widgets![0].label).toBe('Renamed Label')
  })

  test('configure restores an explicit empty input label', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    node.addWidget('number', 'seed', 0, null)
    const input = node.addInput('seed', 'INT')
    input.widget = { name: 'seed' }

    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        {
          name: 'seed',
          type: 'INT',
          link: null,
          label: '',
          widget: { name: 'seed' }
        }
      ],
      widgets_values: [0]
    } as unknown as ISerialisedNode)

    expect(node.widgets![0].label).toBe('')
  })
})
