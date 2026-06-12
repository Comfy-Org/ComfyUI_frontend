import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { IS_CONTROL_WIDGET } from '@/core/graph/widgets/control/controlWidgetMarker'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { runWidgetControl } from './widgetControlSystem'

const controlMode = vi.hoisted(() => ({ value: 'after' as 'before' | 'after' }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.WidgetControlMode' ? controlMode.value : undefined
  })
}))

function markControl(widget: IBaseWidget): IBaseWidget {
  ;(widget as IBaseWidget & Record<symbol, unknown>)[IS_CONTROL_WIDGET] = true
  return widget
}

function addSeedNode(
  graph: LGraph,
  { mode = 'increment', value = 1 }: { mode?: string; value?: number } = {}
): LGraphNode {
  const node = new LGraphNode('SeedNode')
  node.id = 1
  const seed = node.addWidget('number', 'seed', value, () => {}, {
    min: 0,
    max: 1_000_000,
    step2: 1
  })
  const control = node.addWidget(
    'combo',
    'control_after_generate',
    mode,
    () => {},
    { values: ['fixed', 'increment', 'decrement', 'randomize'] }
  )
  markControl(control)
  seed.linkedWidgets = [control]
  graph.add(node)
  return node
}

function seedValue(node: LGraphNode): unknown {
  const store = useWidgetValueStore()
  return store.getWidget(node.widgets![0].widgetId!)?.value
}

describe('runWidgetControl', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    controlMode.value = 'after'
    graph = new LGraph()
    graph.id = 'graph-a'
  })

  it('increments a controlled value after queueing', () => {
    const node = addSeedNode(graph, { mode: 'increment' })

    runWidgetControl(graph, 'after')

    expect(seedValue(node)).toBe(2)
  })

  it('leaves the value unchanged when the mode is fixed', () => {
    const node = addSeedNode(graph, { mode: 'fixed' })

    runWidgetControl(graph, 'after')

    expect(seedValue(node)).toBe(1)
  })

  it('does not run on a target whose input is link-fed', () => {
    const node = addSeedNode(graph, { mode: 'increment' })
    node.addInput('seed', 'number', { link: 1, widget: { name: 'seed' } })

    runWidgetControl(graph, 'after')

    expect(seedValue(node)).toBe(1)
  })

  it('does not run during partial execution', () => {
    const node = addSeedNode(graph, { mode: 'increment' })

    runWidgetControl(graph, 'after', { isPartialExecution: true })

    expect(seedValue(node)).toBe(1)
  })

  it('skips the first queue in before mode, then advances', () => {
    controlMode.value = 'before'
    const node = addSeedNode(graph, { mode: 'increment' })

    runWidgetControl(graph, 'before')
    expect(seedValue(node)).toBe(1)

    runWidgetControl(graph, 'before')
    expect(seedValue(node)).toBe(2)
  })

  it('ignores after-phase work when in before mode', () => {
    controlMode.value = 'before'
    const node = addSeedNode(graph, { mode: 'increment' })

    runWidgetControl(graph, 'after')

    expect(seedValue(node)).toBe(1)
  })

  it('applies a combo filter when advancing a combo value', () => {
    const store = useWidgetValueStore()
    const node = new LGraphNode('CkptNode')
    node.id = 1
    const ckpt = node.addWidget('combo', 'ckpt', 'a.safetensors', () => {}, {
      values: ['a.safetensors', 'b.ckpt', 'c.safetensors']
    })
    const control = markControl(
      node.addWidget('combo', 'control_after_generate', 'increment', () => {}, {
        values: ['fixed', 'increment', 'decrement', 'randomize']
      })
    )
    const filter = node.addWidget(
      'string',
      'control_filter_list',
      'safetensors',
      () => {},
      {}
    )
    ckpt.linkedWidgets = [control, filter]
    graph.add(node)

    runWidgetControl(graph, 'after')

    expect(store.getWidget(ckpt.widgetId!)?.value).toBe('c.safetensors')
  })

  it('only advances controls belonging to the queued graph', () => {
    const node = addSeedNode(graph, { mode: 'increment' })

    const otherGraph = new LGraph()
    otherGraph.id = 'graph-b'
    const otherNode = addSeedNode(otherGraph, { mode: 'increment' })

    runWidgetControl(graph, 'after')

    expect(seedValue(node)).toBe(2)
    expect(seedValue(otherNode)).toBe(1)
  })

  it('preserves the before-mode skip when the widget re-registers', () => {
    controlMode.value = 'before'
    const node = addSeedNode(graph, { mode: 'increment' })

    runWidgetControl(graph, 'before')
    expect(seedValue(node)).toBe(1)

    const seed = node.widgets![0]
    if (isNodeBindable(seed)) seed.setNodeId(node.id)

    runWidgetControl(graph, 'before')
    expect(seedValue(node)).toBe(2)
  })
})
