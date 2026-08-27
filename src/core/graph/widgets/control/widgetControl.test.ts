import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import {
  getWidgetControlView,
  registerWidgetControlFromConfig
} from './widgetControl'

function createControlledNode(): { graph: LGraph; node: LGraphNode } {
  const graph = new LGraph()
  const node = new LGraphNode('TestNode')
  node.serialize_widgets = true
  const seed = node.addWidget('number', 'seed', 0, () => {}, {})
  seed.controlConfig = { mode: 'randomize', hasFilter: false }
  node.addWidget('text', 'prompt', '', () => {}, {})
  graph.add(node)
  return { graph, node }
}

describe('widget control persistence', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('round-trips the component through the legacy positional layout', () => {
    const { node } = createControlledNode()

    node.configure({
      ...node.serialize(),
      widgets_values: [12345, 'increment', 'a prompt']
    })

    const target = node.widgets?.[0]
    expect(target?.value).toBe(12345)
    expect(node.widgets?.[1].value).toBe('a prompt')
    expect(
      target?.widgetId
        ? useWidgetValueStore().getWidgetControl(target.widgetId)?.mode
        : undefined
    ).toBe('increment')
    expect(node.serialize().widgets_values).toEqual([
      12345,
      'increment',
      'a prompt'
    ])
  })

  it.for([
    { value: true, mode: 'randomize' },
    { value: false, mode: 'fixed' }
  ] as const)(
    'restores legacy boolean control value $value',
    ({ value, mode }) => {
      const { node } = createControlledNode()

      node.configure({
        ...node.serialize(),
        widgets_values: [12345, value, 'a prompt']
      })

      const target = node.widgets?.[0]
      expect(node.widgets?.map((widget) => widget.value)).toEqual([
        12345,
        'a prompt'
      ])
      expect(
        target?.widgetId
          ? useWidgetValueStore().getWidgetControl(target.widgetId)?.mode
          : undefined
      ).toBe(mode)
    }
  )

  it('restores a control before its node is attached to a graph', () => {
    const node = new LGraphNode('TestNode')
    node.serialize_widgets = true
    const seed = node.addWidget('number', 'seed', 0, () => {}, {})
    seed.controlConfig = { mode: 'randomize', hasFilter: false }
    node.addWidget('text', 'prompt', '', () => {}, {})

    node.configure({
      ...node.serialize(),
      widgets_values: [12345, true, 'a prompt']
    })
    const graph = new LGraph()
    graph.add(node)

    expect(node.widgets?.map((widget) => widget.value)).toEqual([
      12345,
      'a prompt'
    ])
    expect(
      seed.widgetId
        ? useWidgetValueStore().getWidgetControl(seed.widgetId)?.mode
        : undefined
    ).toBe('randomize')
  })

  it('does not consume the next widget when the control slot is absent', () => {
    const { node } = createControlledNode()

    node.configure({
      ...node.serialize(),
      widgets_values: [12345, 'increment']
    })

    expect(node.widgets?.map(({ value }) => value)).toEqual([
      12345,
      'increment'
    ])
  })

  it('aligns omitted controls when a later widget has control values', () => {
    const { node } = createControlledNode()
    const steps = node.addWidget('number', 'steps', 1, () => {}, {})
    steps.controlConfig = { mode: 'randomize', hasFilter: false }
    registerWidgetControlFromConfig(steps)

    node.configure({
      ...node.serialize(),
      widgets_values: [12345, 'increment', 7, 'decrement']
    })

    expect(node.widgets?.map(({ value }) => value)).toEqual([
      12345,
      'increment',
      7
    ])
    expect(
      steps.widgetId
        ? useWidgetValueStore().getWidgetControl(steps.widgetId)?.mode
        : undefined
    ).toBe('decrement')
  })

  it('exposes combo wrap mode through the Vue control view', () => {
    const { node } = createControlledNode()
    const target = node.widgets?.[0]
    if (!target?.widgetId) throw new Error('Target widget was not registered')
    useWidgetValueStore().updateWidgetControl(target.widgetId, {
      mode: 'increment-wrap'
    })

    expect(getWidgetControlView(target)?.value).toBe('increment-wrap')
  })

  it('moves and removes the component with its target widget', () => {
    const { node } = createControlledNode()
    const store = useWidgetValueStore()
    const target = node.widgets?.[0]
    const oldId = target?.widgetId
    if (!target || !oldId) throw new Error('Target widget was not registered')

    target.name = 'renamed_seed'
    const newId = target.widgetId

    expect(store.getWidgetControl(oldId)).toBeUndefined()
    expect(newId ? store.getWidgetControl(newId)?.mode : undefined).toBe(
      'randomize'
    )

    node.removeWidget(target)
    expect(newId ? store.getWidgetControl(newId) : undefined).toBeUndefined()
  })
})
