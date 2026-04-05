import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('Widget options.values serialization', () => {
  it('preserves combo options.values through serialize/configure round-trip', () => {
    const graph = new LGraph()

    // Create node with combo + option widgets manually
    const node = new LGraphNode('TestCombo')
    node.serialize_widgets = true
    node.addWidget('combo', 'value', 'alpha', () => {}, {
      values: ['alpha', 'beta', 'gamma']
    })
    node.addWidget('string', 'option1', 'alpha', () => {})
    node.addWidget('string', 'option2', 'beta', () => {})
    node.addWidget('string', 'option3', 'gamma', () => {})
    graph.add(node)

    // Serialize
    const serialized = node.serialize()

    // Create fresh node and configure
    const restored = new LGraphNode('TestCombo')
    restored.serialize_widgets = true
    const restoredCombo = restored.addWidget('combo', 'value', '', () => {}, {
      values: [] as string[]
    })
    restored.addWidget('string', 'option1', '', () => {})
    restored.addWidget('string', 'option2', '', () => {})
    restored.addWidget('string', 'option3', '', () => {})
    graph.add(restored)

    restored.configure(serialized)

    // Widget values should be restored
    expect(restored.widgets![0].value).toBe('alpha')
    expect(restored.widgets![1].value).toBe('alpha')
    expect(restored.widgets![2].value).toBe('beta')
    expect(restored.widgets![3].value).toBe('gamma')

    // BUG: combo options.values should also be restored
    // but configure only restores widget.value, not widget.options
    const restoredValues = restoredCombo.options.values as string[]
    expect(restoredValues).toContain('alpha')
    expect(restoredValues).toContain('beta')
    expect(restoredValues).toContain('gamma')
  })
})
