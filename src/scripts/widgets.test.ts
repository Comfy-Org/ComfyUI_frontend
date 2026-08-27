import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { addValueControlWidget, addValueControlWidgets } from './widgets'

describe('legacy value control API', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('configures the target and returns component-backed projections', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    const seed = node.addWidget('number', 'seed', 1, () => {}, {})
    const combo = node.addWidget('combo', 'choice', 'a', () => {}, {
      values: ['a', 'b']
    })

    const mode = addValueControlWidget(node, seed, 'increment')
    const controls = addValueControlWidgets(node, combo, 'randomize')
    controls[0].value = 'increment-wrap'
    controls[1].value = 'b'
    graph.add(node)

    const store = useWidgetValueStore()
    expect(
      seed.widgetId ? store.getWidgetControl(seed.widgetId)?.mode : null
    ).toBe('increment')
    expect(mode.value).toBe('increment')
    expect(
      combo.widgetId ? store.getWidgetControl(combo.widgetId) : undefined
    ).toMatchObject({ mode: 'increment-wrap', filter: 'b' })
  })
})
