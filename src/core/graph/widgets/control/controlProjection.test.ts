import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { getControlProjections } from './controlProjection'

describe('classic control projection', () => {
  it('renders and edits component state without entering node.widgets', () => {
    const graph = new LGraph()
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 1, () => {}, {})
    seed.controlConfig = { mode: 'increment', hasFilter: false }
    graph.add(node)

    const rendered = node.getLayoutWidgets()
    expect(node.widgets?.map(({ name }) => name)).toEqual(['seed'])
    expect(rendered.map(({ name }) => name)).toEqual([
      'seed',
      'control_after_generate'
    ])

    rendered[1].callback?.('randomize')
    expect(
      seed.widgetId
        ? useWidgetValueStore().getWidgetControl(seed.widgetId)?.mode
        : undefined
    ).toBe('randomize')
  })

  it('delegates target visibility to every projection', () => {
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('combo', 'seed', 'one', () => {}, {
      values: ['one', 'two']
    })
    seed.controlConfig = {
      mode: 'increment',
      hasFilter: true,
      filter: ''
    }
    seed.hidden = true
    seed.advanced = true
    seed.connectionSuppressed = true

    const projections = getControlProjections(seed)
    expect(projections).toHaveLength(2)
    for (const projection of projections) {
      expect(projection.visibility).toBe(seed.visibility)
      expect(projection.hidden).toBe(true)
      expect(projection.advanced).toBe(true)
      expect(projection.connectionSuppressed).toBe(true)
    }
  })

  it('converts projections for classic canvas drawing', () => {
    const node = new LGraphNode('SeedNode')
    const seed = node.addWidget('number', 'seed', 1, () => {}, {})
    seed.controlConfig = { mode: 'increment', hasFilter: false }
    const [projection] = getControlProjections(seed)
    if (!projection) throw new Error('Expected a control projection')

    const concrete = toConcreteWidget(projection, node)

    expect(concrete.visibility).toBe(seed.visibility)
    seed.hidden = true
    expect(concrete.hidden).toBe(true)
  })
})
