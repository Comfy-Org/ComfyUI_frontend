import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function addControlledNode(
  graph: LGraph,
  configure: (node: LGraphNode) => void
): LGraphNode {
  const node = new LGraphNode('TestNode')
  node.id = 1
  configure(node)
  graph.add(node)
  return node
}

describe('widget control positional (de)serialization', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
  })

  it('loads legacy [target, mode] for a number control without shifting later widgets', () => {
    const node = addControlledNode(graph, (n) => {
      const seed = n.addWidget('number', 'seed', 0, null, {}) as IBaseWidget
      n.addWidget('text', 'prompt', '', null, {})
      seed.controlConfig = { mode: 'randomize', hasFilter: false }
    })

    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: [12345, 'increment', 'a prompt']
    })

    const store = useWidgetValueStore()
    expect(node.widgets![0].value).toBe(12345)
    expect(node.widgets![1].value).toBe('a prompt')
    expect(store.getWidgetControl(node.widgets![0].widgetId!)?.mode).toBe(
      'increment'
    )
  })

  it('loads legacy [target, mode, filter] for a combo control without shifting later widgets', () => {
    const node = addControlledNode(graph, (n) => {
      const ckpt = n.addWidget('combo', 'ckpt', 'a', null, {
        values: ['a', 'b', 'c']
      }) as IBaseWidget
      n.addWidget('text', 'prompt', '', null, {})
      ckpt.controlConfig = { mode: 'increment', hasFilter: true }
    })

    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: ['b', 'increment-wrap', 'safetensors', 'a prompt']
    })

    const store = useWidgetValueStore()
    const control = store.getWidgetControl(node.widgets![0].widgetId!)
    expect(node.widgets![0].value).toBe('b')
    expect(node.widgets![1].value).toBe('a prompt')
    expect(control?.mode).toBe('increment-wrap')
    expect(control?.filter).toBe('safetensors')
  })

  it('round-trips control state through the classic positional layout', () => {
    const node = addControlledNode(graph, (n) => {
      n.serialize_widgets = true
      const ckpt = n.addWidget('combo', 'ckpt', 'a', null, {
        values: ['a', 'b', 'c']
      }) as IBaseWidget
      n.addWidget('text', 'prompt', '', null, {})
      ckpt.controlConfig = { mode: 'increment', hasFilter: true }
    })
    node.configure({
      id: 1,
      type: 'TestNode',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: ['b', 'increment-wrap', 'safetensors', 'a prompt']
    })

    expect(node.serialize().widgets_values).toEqual([
      'b',
      'increment-wrap',
      'safetensors',
      'a prompt'
    ])
  })
})
