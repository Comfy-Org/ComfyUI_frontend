import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function addControlledNode(
  graph: LGraph,
  type: 'number' | 'combo',
  filter?: string
): LGraphNode {
  const node = new LGraphNode('Controlled')
  node.id = 1
  const widget = node.addWidget(
    type,
    'seed',
    type === 'combo' ? 'a' : 1,
    () => {},
    {
      values: ['a', 'b', 'c']
    }
  )
  graph.add(node)
  useWidgetValueStore().registerWidgetControl(widget.widgetId!, {
    mode: 'increment',
    filter
  })
  return node
}

describe('control projection on the classic canvas', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    graph.id = 'graph-a'
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('interleaves a control row after a controlled widget', () => {
    const node = addControlledNode(graph, 'number')

    const rendered = node.getRenderWidgets()
    expect(rendered.map((w) => w.name)).toEqual([
      'seed',
      'control_after_generate'
    ])
    expect(rendered[1].type).toBe('combo')
    expect(rendered[1].value).toBe('increment')
  })

  it('adds a filter row only for combo targets that carry a filter', () => {
    const node = addControlledNode(graph, 'combo', '')

    expect(node.getRenderWidgets().map((w) => w.name)).toEqual([
      'seed',
      'control_after_generate',
      'control_filter_list'
    ])
  })

  it('reads and writes the control component through the projection', () => {
    const node = addControlledNode(graph, 'number')
    const store = useWidgetValueStore()
    const control = node.getRenderWidgets()[1]

    control.callback?.(
      'randomize',
      undefined as never,
      node,
      [0, 0],
      undefined as never
    )

    expect(store.getWidgetControl(node.widgets![0].widgetId!)?.mode).toBe(
      'randomize'
    )
    expect(control.value).toBe('randomize')
  })

  it('omits projections in Vue node mode', () => {
    const node = addControlledNode(graph, 'number')
    LiteGraph.vueNodesMode = true

    expect(node.getRenderWidgets().map((w) => w.name)).toEqual(['seed'])
  })

  it('drops the control row when the component is removed', () => {
    const node = addControlledNode(graph, 'number')
    useWidgetValueStore().deleteWidgetControl(node.widgets![0].widgetId!)

    expect(node.getRenderWidgets().map((w) => w.name)).toEqual(['seed'])
  })
})
