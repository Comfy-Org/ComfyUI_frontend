import { afterEach, describe, expect, it, vi } from 'vitest'

import { ASSERTION_FAILURE_PREFIX } from '@/base/assert'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { setWidgetValuesFormPolicy } from '@/lib/litegraph/src/widgets/widgetValuesForm'

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
    setWidgetValuesFormPolicy(undefined)
  })

  function installPolicy(layoutDependsOnValues = false) {
    setWidgetValuesFormPolicy({
      widgetLayoutDependsOnValues: () => layoutDependsOnValues
    })
  }

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

  it.for([
    {
      hook: 'replaces the values',
      onSerialize: (data: ISerialisedNode) => {
        data.widgets_values = ['changed']
      }
    },
    {
      hook: 'appends a value in place',
      onSerialize: (data: ISerialisedNode) => {
        data.widgets_values?.push('extra')
      }
    },
    {
      hook: 'reorders values in place',
      onSerialize: (data: ISerialisedNode) => {
        data.widgets_values?.reverse()
      }
    }
  ])('suppresses an inferred form when a hook $hook', ({ onSerialize }) => {
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'hello' },
      { name: 'seed', value: '7' }
    ])
    node.onSerialize = onSerialize

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('leaves a value-dependent widget layout undeclared', () => {
    installPolicy(true)
    const node = nodeWithWidgets([
      { name: 'mode', value: 'a' },
      { name: 'mode.steps', value: '4' }
    ])

    expect(node.serialize()).toMatchObject({ widgets_values: ['a', '4'] })
    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it.for([
    { widgets: 'an unlabeled widget', names: [''] },
    { widgets: 'widgets sharing a name', names: ['prompt', 'prompt'] }
  ])('keeps $widgets positional instead of declaring it', ({ names }) => {
    const node = new LGraphNode('test')
    node.serialize_widgets = true
    for (const name of names) node.addWidget('text', name, name, () => {}, {})

    expect(node.serialize()).toMatchObject({ widgets_values: names })
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

  it('leaves an undeclared object serializer opaque', () => {
    installPolicy()
    const node = nodeWithWidgets([{ name: 'prompt', value: 'hello' }])
    node.onSerialize = (data) => {
      Reflect.set(data, 'widgets_values', { prompt: 'hello' })
    }

    expect(node.serialize()).toMatchObject({
      widgets_values: { prompt: 'hello' }
    })
    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it.for([
    {
      form: 'length disagrees with array values',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          data.widgets_values?.push('extra')
          data.widgets_values_form = { order: ['prompt', 'seed'] }
        }
      }
    },
    {
      form: 'repeats a name',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          data.widgets_values_form = { order: ['prompt', 'prompt'] }
        }
      }
    },
    {
      form: 'carries a key besides order',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          Reflect.set(data, 'widgets_values_form', {
            order: ['prompt', 'seed'],
            extra: true
          })
        }
      }
    },
    {
      form: 'describes values the hook deleted',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          delete data.widgets_values
          data.widgets_values_form = { order: ['prompt', 'seed'] }
        }
      }
    },
    {
      form: 'names a key missing from object values',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          Reflect.set(data, 'widgets_values', { prompt: 'hello' })
          data.widgets_values_form = { order: ['prompt', 'seed'] }
        }
      }
    },
    {
      form: 'orders names differently from widgets',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          data.widgets_values_form = { order: ['seed', 'prompt'] }
        }
      }
    },
    {
      form: 'follows widgets a hook reordered',
      arrange: (node: LGraphNode) => {
        node.onSerialize = (data) => {
          node.widgets?.reverse()
          data.widgets_values_form = { order: ['seed', 'prompt'] }
        }
      }
    }
  ])('drops a declared form that $form', ({ arrange }) => {
    vi.stubEnv('DEV', false)
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'hello' },
      { name: 'seed', value: '7' }
    ])
    arrange(node)

    expect(node.serialize()).not.toHaveProperty('widgets_values_form')
  })

  it('fails loudly in development on a malformed declared form', () => {
    const node = nodeWithWidgets([
      { name: 'prompt', value: 'first' },
      { name: 'second_prompt', value: 'second' }
    ])
    node.onSerialize = (data) => {
      data.widgets_values_form = { order: ['prompt', 'prompt'] }
    }

    expect(() => node.serialize()).toThrow(ASSERTION_FAILURE_PREFIX)
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
