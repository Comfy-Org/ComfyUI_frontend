import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, isReactive } from 'vue'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { renameWidget } from '@/utils/widgetUtil'

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

class PlainNode extends LGraphNode {
  static override title = 'Plain'
  constructor() {
    super('Plain')
    this.addInput('in', 'STRING')
    this.addOutput('out', 'STRING')
  }
}

/**
 * Regression #16642: after the ECS migration nothing explicitly re-extracted
 * slot data on `node:slot-label:changed`. Slot labels must remain reactive so
 * the Vue slot renderers update on label-only renames.
 */
describe('slot label reactivity (regression #16642)', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType(
      'test/CLIPTextEncodeLike',
      ClipTextEncodeLikeNode
    )
    LiteGraph.registerNodeType('test/Plain', PlainNode)
    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14,
      isValidConnection: vi.fn().mockReturnValue(true)
    })
  })

  test('input slot label is reactive after renameWidget', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/CLIPTextEncodeLike')!
    graph.add(node)
    const widget = node.widgets![0]

    const inputLabel = computed(() => node.inputs[0].label)
    expect(inputLabel.value).toBeUndefined()

    renameWidget(widget, node, 'prompt')

    expect(node.inputs[0].label).toBe('prompt')
    expect(inputLabel.value).toBe('prompt')
    expect(isReactive(node.inputs[0])).toBe(true)
  })

  test('widget store label is reactive after renameWidget', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/CLIPTextEncodeLike')!
    graph.add(node)
    const widget = node.widgets![0]
    const store = useWidgetValueStore()
    const widgetId = widget.widgetId
    if (!widgetId) throw new Error('widgetId missing')

    const storeLabel = computed(() => store.getWidget(widgetId)?.label)
    expect(storeLabel.value).toBeUndefined()

    renameWidget(widget, node, 'prompt')

    expect(storeLabel.value).toBe('prompt')
    expect(isReactive(store.getWidget(widgetId)!)).toBe(true)
  })

  test('direct input/output label writes are reactive', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/Plain')!
    graph.add(node)

    const inLabel = computed(() => node.inputs[0].label)
    const outLabel = computed(() => node.outputs[0].label)
    expect(inLabel.value).toBeUndefined()
    expect(outLabel.value).toBeUndefined()

    node.inputs[0].label = 'renamed in'
    node.outputs[0].label = 'renamed out'

    expect(inLabel.value).toBe('renamed in')
    expect(outLabel.value).toBe('renamed out')
    expect(isReactive(node.outputs[0])).toBe(true)
  })

  test('slots restored via configure() are reactive', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/Plain')!
    graph.add(node)
    node.configure({
      id: node.id,
      type: 'test/Plain',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'in', type: 'STRING', link: null }],
      outputs: [{ name: 'out', type: 'STRING', links: [] }]
    })

    const inLabel = computed(() => node.inputs[0].label)
    const outLabel = computed(() => node.outputs[0].label)

    node.inputs[0].label = 'a'
    node.outputs[0].label = 'b'

    expect(inLabel.value).toBe('a')
    expect(outLabel.value).toBe('b')
  })

  test('plain-object output written by index is upgraded and reactive', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('test/Plain')!
    graph.add(node)

    const outLabel = computed(() => node.outputs[0].label)
    expect(outLabel.value).toBeUndefined()

    // Extensions historically replaced slots with plain objects.
    node.outputs[0] = {
      name: 'out',
      type: 'STRING',
      links: []
    } as unknown as INodeOutputSlot
    expect(outLabel.value).toBeUndefined()

    node.outputs[0].label = 'c'

    expect(outLabel.value).toBe('c')
    expect(isReactive(node.outputs[0])).toBe(true)
  })
})
