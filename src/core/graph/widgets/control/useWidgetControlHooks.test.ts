import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import { runWidgetControl } from '@/core/graph/widgets/widgetControlSystem'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { installWidgetControlHooks } from './useWidgetControlHooks'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.WidgetControlMode' ? 'after' : undefined
  })
}))

function controlFor(
  store: ReturnType<typeof useWidgetValueStore>,
  graph: LGraph,
  targetId: string
) {
  return store
    .getWidgetControls(graph.rootGraph.id)
    .find(([id]) => id === targetId)?.[1]
}

function addSeedNode(graph: LGraph): LGraphNode {
  const node = new LGraphNode('SeedNode')
  node.id = 1
  const seed = node.addWidget('number', 'seed', 1, () => {}, {
    min: 0,
    max: 1_000_000,
    step2: 1
  })
  const control = node.addWidget(
    'combo',
    'control_after_generate',
    'increment',
    () => {},
    { values: ['fixed', 'increment', 'decrement', 'randomize'] }
  )
  ;(control as IBaseWidget & Record<symbol, unknown>)[IS_CONTROL_WIDGET] = true
  seed.linkedWidgets = [control]
  graph.add(node)
  return node
}

describe('installWidgetControlHooks', () => {
  let graph: LGraph
  let store: ReturnType<typeof useWidgetValueStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useWidgetValueStore()
    graph = new LGraph()
  })

  it('registers a control component for a control-target widget', () => {
    const node = addSeedNode(graph)
    const seedId = node.widgets![0].widgetId!

    installWidgetControlHooks(graph)

    const control = controlFor(store, graph, seedId)
    expect(control?.controlWidgetId).toBe(node.widgets![1].widgetId)
  })

  it('advances the registered target value through the control system', () => {
    const node = addSeedNode(graph)
    const seedId = node.widgets![0].widgetId!
    installWidgetControlHooks(graph)

    runWidgetControl(graph.rootGraph.id, 'after')

    expect(store.getWidget(seedId)?.value).toBe(2)
  })

  it('removes the control component when the node is removed', () => {
    const node = addSeedNode(graph)
    const seedId = node.widgets![0].widgetId!
    installWidgetControlHooks(graph)
    expect(controlFor(store, graph, seedId)).toBeDefined()

    graph.remove(node)

    expect(controlFor(store, graph, seedId)).toBeUndefined()
  })

  it('registers controls for nodes added after install', () => {
    installWidgetControlHooks(graph)
    const node = addSeedNode(graph)
    const seedId = node.widgets![0].widgetId!

    expect(controlFor(store, graph, seedId)).toBeDefined()
  })

  it('restores the original node callback on uninstall', () => {
    const node = addSeedNode(graph)
    const original = node.onConnectionsChange
    const uninstall = installWidgetControlHooks(graph)
    expect(node.onConnectionsChange).not.toBe(original)

    uninstall()

    expect(node.onConnectionsChange).toBe(original)
  })
})
