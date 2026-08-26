import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { runWidgetControl } from './widgetControlSystem'

const controlPhase = vi.hoisted(() => ({ value: 'after' }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => controlPhase.value
  })
}))

function createControlledSeed(callback = vi.fn()) {
  const graph = new LGraph()
  const node = new LGraphNode('SeedNode')
  const seed = node.addWidget('number', 'seed', 1, callback, {
    min: 0,
    max: 100,
    step2: 1
  })
  seed.controlConfig = { mode: 'increment', hasFilter: false }
  graph.add(node)
  return { callback, graph, node, seed }
}

describe('runWidgetControl', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    controlPhase.value = 'after'
  })

  it('advances the target and invokes its compatibility callback', () => {
    const { callback, graph, seed } = createControlledSeed()

    runWidgetControl(graph, 'after')

    expect(seed.value).toBe(2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('skips partial and link-fed targets', () => {
    const { graph, node, seed } = createControlledSeed()
    node.addInput('seed', 'number', { widget: { name: 'seed' } })
    const source = new LGraphNode('Source')
    source.addOutput('value', 'number')
    graph.add(source)
    source.connect(0, node, 0)

    runWidgetControl(graph, 'after')
    expect(seed.value).toBe(1)

    node.disconnectInput(0)
    runWidgetControl(graph, 'after', { isPartialExecution: true })
    expect(seed.value).toBe(1)
  })

  it('skips the first execution in before mode', () => {
    controlPhase.value = 'before'
    const { graph, seed } = createControlledSeed()

    runWidgetControl(graph, 'before')
    expect(seed.value).toBe(1)

    runWidgetControl(graph, 'before')
    expect(seed.value).toBe(2)
  })
})
