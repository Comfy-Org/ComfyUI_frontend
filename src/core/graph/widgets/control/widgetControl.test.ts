import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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

  it('does not consume the next widget when the control slot is absent', () => {
    const { node } = createControlledNode()

    node.configure({
      ...node.serialize(),
      widgets_values: [12345, 'a prompt']
    })

    expect(node.widgets?.map(({ value }) => value)).toEqual([12345, 'a prompt'])
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
