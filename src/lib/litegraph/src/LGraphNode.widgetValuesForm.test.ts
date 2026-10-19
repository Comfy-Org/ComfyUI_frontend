import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { setWidgetSerializationFormReporter } from '@/lib/litegraph/src/widgetSerializationFormReporter'

function nodeWithWidgets(
  widgets: readonly { name: string; value: string }[]
): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  node.serialize_widgets = true
  graph.add(node)
  for (const { name, value } of widgets)
    node.addWidget('text', name, value, () => undefined, {})
  return node
}

describe('widget values form serialization', () => {
  afterEach(() => {
    setWidgetSerializationFormReporter(undefined)
  })

  it('emits the form after extension serialization', () => {
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'hello' },
      { name: 'seed', value: '7' }
    ])
    node.onSerialize = (data) => {
      expect(data.widgets_values_form).toBeUndefined()
    }

    expect(node.serialize().widgets_values_form).toEqual({
      order: ['prompt', 'seed']
    })
  })

  it('uses the widget-level serialize flag only', () => {
    const node = nodeWithWidgets([
      { name: 'kept', value: 'a' },
      { name: 'option-only', value: 'b' },
      { name: 'skipped', value: 'c' }
    ])
    node.widgets![1].options.serialize = false
    node.widgets![2].serialize = false

    expect(node.serialize()).toMatchObject({
      widgets_values: ['a', 'b'],
      widgets_values_form: { order: ['kept', 'option-only'] }
    })
  })

  it('suppresses an inferred form when a hook replaces the values', () => {
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      data.widgets_values = ['changed']
    }

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('suppresses an inferred form when a hook appends a value in place', () => {
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      data.widgets_values?.push('extra')
    }

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('suppresses an inferred form when a hook reorders values in place', () => {
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'hello' },
      { name: 'seed', value: '7' }
    ])
    node.onSerialize = (data) => {
      data.widgets_values?.reverse()
    }

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('suppresses an inferred form when widget serialization is disabled', () => {
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.serialize_widgets = false

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('suppresses an empty form when every widget opts out', () => {
    const node = nodeWithWidgets([{ name: 'skipped', value: 'hello' }])
    node.widgets![0].serialize = false

    expect(node.serialize()).toMatchObject({ widgets_values: [] })
    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('preserves a valid object form as a canonical field', () => {
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      Reflect.set(data, 'widgets_values', {
        prompt: 'hello',
        extensionResidue: 'kept'
      })
      data.widgets_values_form = { order: ['prompt'] }
    }

    const serialised = node.serialize()

    expect(serialised.widgets_values_form).toEqual({ order: ['prompt'] })
    expect(serialised.extensions).toBeUndefined()

    const restored = new LGraphNode('restored')
    restored.configure(serialised)
    expect(Object.hasOwn(restored, 'widgets_values_form')).toBe(false)
  })

  it('reports object-shaped values without a declared form', () => {
    const reporter = vi.fn()
    setWidgetSerializationFormReporter(reporter)
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      Reflect.set(data, 'widgets_values', { prompt: 'hello' })
    }

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
    expect(reporter).toHaveBeenCalledWith({
      nodeId: String(node.id),
      nodeType: node.type
    })
  })

  it('rejects a form whose length disagrees with array values', () => {
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'hello' },
      { name: 'seed', value: '7' }
    ])
    node.onSerialize = (data) => {
      data.widgets_values_form = { order: ['prompt'] }
    }

    expect(() => node.serialize()).toThrow(
      '[Assertion failed]: Widget values form length must match array-shaped values'
    )
  })

  it('rejects a form after a hook deletes the values it describes', () => {
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      delete data.widgets_values
      data.widgets_values_form = { order: ['prompt'] }
    }

    expect(() => node.serialize()).toThrow(
      '[Assertion failed]: Widget values form must describe array- or object-shaped values'
    )
  })

  it('preserves a saved form on a missing-node shell', () => {
    const node = nodeWithWidgets([{ name: 'UNKNOWN', value: 'hello' }])
    const saved: ISerialisedNode = {
      id: node.id,
      type: 'MissingNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: ['hello'],
      widgets_values_form: { order: ['prompt'] }
    }
    node.last_serialization = saved

    const serialised = node.serialize()
    expect(serialised.widgets_values).toEqual(['hello'])
    expect(serialised.widgets_values_form).toEqual({ order: ['prompt'] })
    expect(serialised.widgets_values).not.toBe(saved.widgets_values)
    expect(serialised.widgets_values_form).not.toBe(saved.widgets_values_form)
  })

  it('does not retain a base form after subgraph serialization replaces values', () => {
    const widgetNode = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.serialize_widgets = true
    Object.defineProperty(subgraphNode, 'widgets', {
      value: widgetNode.widgets
    })

    expect(subgraphNode.serialize()).not.toHaveProperty('widgets_values_form')
  })
})
