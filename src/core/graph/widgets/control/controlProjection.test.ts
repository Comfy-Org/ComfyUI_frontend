import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

describe('classic control projection', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

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
})
