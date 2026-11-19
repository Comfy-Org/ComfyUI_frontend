import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphNode,
  isComboWidget
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { resolveComboValues } from '@/utils/litegraphUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, WidgetCollection } from '@/platform/nodeApi/v4/types'

describe('a node’s widgets', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost
  const changes: [string, unknown][] = []
  let probe: () => unknown = () => undefined
  const history = {
    beforeChange: () => changes.push(['start', probe()]),
    afterChange: () => changes.push(['end', probe()])
  }

  beforeEach(() => {
    changes.length = 0
    probe = () => undefined
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({
      getGraph: () => graph,
      history: () => history
    }))
  })

  function nodeWith(...names: string[]) {
    const node = new LGraphNode('Node', 'TestNode')
    node.serialize_widgets = true
    graph.add(node)
    for (const name of names) node.addWidget('number', name, 1, () => {}, {})
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return { node, handle, widgets: handle.widgets }
  }

  function storedOrder(node: LGraphNode): string[] {
    return useWidgetValueStore()
      .getNodeWidgets(graph.rootGraph.id, node.id)
      .map(({ name }) => name)
  }

  describe('reads', () => {
    it('lists the widgets in the order the node shows them', () => {
      const { widgets } = nodeWith('seed', 'steps', 'cfg')

      expect(widgets.length).toBe(3)
      expect(widgets.names()).toEqual(['seed', 'steps', 'cfg'])
      expect(widgets.all()?.map(({ name }) => name)).toEqual([
        'seed',
        'steps',
        'cfg'
      ])
      expect(Array.from(widgets, ({ name }) => name)).toEqual([
        'seed',
        'steps',
        'cfg'
      ])
    })

    it('gives one handle per widget however it is reached', () => {
      const { widgets } = nodeWith('seed', 'steps')
      const seed = widgets.get('seed')

      expect(seed).toBeDefined()
      expect(widgets.at(0)).toBe(seed)
      expect(widgets.all()?.[0]).toBe(seed)
      expect(comfy.sameEntity(seed, widgets.get('seed'))).toBe(true)
      expect(comfy.sameEntity(seed, widgets.get('steps'))).toBe(false)
    })

    it('counts back from the end for a negative index, and has nothing past either end', () => {
      const { widgets } = nodeWith('seed', 'steps')

      expect(widgets.at(-1)?.name).toBe('steps')
      expect(widgets.at(2)).toBeUndefined()
      expect(widgets.at(-3)).toBeUndefined()
    })

    it('has no widget by a name the node does not have', () => {
      const { widgets } = nodeWith('seed')

      expect(widgets.get('steps')).toBeUndefined()
      expect(widgets.get('toString')).toBeUndefined()
    })

    it('returns lists a pack cannot change', () => {
      const { node, widgets } = nodeWith('seed')
      const names = widgets.names()
      const all = widgets.all()

      expect(Object.isFrozen(names)).toBe(true)
      expect(Object.isFrozen(all)).toBe(true)
      expect(Object.isFrozen(widgets)).toBe(true)
      expect(() => Reflect.apply(Array.prototype.push, names, ['x'])).toThrow(
        TypeError
      )
      expect(node.widgets?.map(({ name }) => name)).toEqual(['seed'])
    })

    it('is the same collection each time the node handle is read', () => {
      const { handle } = nodeWith('seed')

      expect(handle.widgets).toBe(handle.widgets)
    })

    it('reads an empty node as no widgets', () => {
      const { widgets } = nodeWith()

      expect(widgets.length).toBe(0)
      expect(widgets.names()).toEqual([])
      expect(widgets.at(0)).toBeUndefined()
    })

    it.for([[1], [undefined], [null], [{}]])(
      'refuses a name that is not a string: %o',
      ([name]) => {
        const { widgets } = nodeWith('seed')

        expect(() => Reflect.apply(widgets.get, widgets, [name])).toThrow(
          'get needs a widget name'
        )
        expect(() => Reflect.apply(widgets.remove, widgets, [name])).toThrow(
          'remove needs a widget name'
        )
      }
    )

    it.for([[0.5], [Number.NaN], [Infinity], ['0'], [undefined]])(
      'refuses an index that is not a whole number: %o',
      ([index]) => {
        const { widgets } = nodeWith('seed')

        expect(() => Reflect.apply(widgets.at, widgets, [index])).toThrow(
          'at needs a whole number'
        )
      }
    )
  })

  describe('a deleted or retired node', () => {
    function expectGone(widgets: WidgetCollection) {
      expect(widgets.length).toBeUndefined()
      expect(widgets.names()).toBeUndefined()
      expect(widgets.all()).toBeUndefined()
      expect(widgets.get('seed')).toBeUndefined()
      expect(widgets.at(0)).toBeUndefined()
      expect(Array.from(widgets)).toEqual([])
      expect(widgets.add({ type: 'number', name: 'added' })).toBeUndefined()
      expect(widgets.remove('seed')).toBe(false)
    }

    it('reads nothing and changes nothing once the node is removed', () => {
      const { node, widgets } = nodeWith('seed', 'steps')

      expect(widgets.length).toBe(2)

      graph.remove(node)

      expectGone(widgets)
      expect(widgets.reorder(['steps', 'seed'])).toBe(false)
      expect(widgets.move('seed', 1)).toBe(false)
      expect(node.widgets?.map(({ name }) => name)).toEqual(['seed', 'steps'])
      expect(changes).toEqual([])
    })

    it('reads nothing once another document reuses the node’s id', () => {
      const { node, widgets } = nodeWith('seed')
      const sameId = new LGraphNode('Other', 'TestNode')
      sameId.id = node.id
      sameId.addWidget('number', 'seed', 7, () => {}, {})

      graph.remove(node)
      host.beginDocument()
      graph.add(sameId)

      expectGone(widgets)
      expect(sameId.widgets?.map(({ name }) => name)).toEqual(['seed'])
    })

    it('still refuses an argument it cannot use', () => {
      const { node, widgets } = nodeWith('seed')
      graph.remove(node)

      expect(() => Reflect.apply(widgets.get, widgets, [1])).toThrow(TypeError)
      expect(() => widgets.add(Object.create(null))).toThrow(TypeError)
    })
  })

  describe('add', () => {
    it('adds a widget from a definition and gives its handle', () => {
      const { node, widgets } = nodeWith('seed')

      const added = widgets.add({
        type: 'combo',
        name: 'sampler',
        value: 'euler',
        options: { values: ['euler', 'dpm'] }
      })

      expect(added).toBe(widgets.get('sampler'))
      expect(widgets.names()).toEqual(['seed', 'sampler'])
      expect(added?.widgetType).toBe('combo')
      expect(added?.getValue()).toBe('euler')
      expect(added?.getOptions()?.values).toEqual(['euler', 'dpm'])
      expect(storedOrder(node)).toEqual(['seed', 'sampler'])
    })

    it('reads the type in lower case, as the host’s addWidget does', () => {
      const { node, widgets } = nodeWith()

      const added = widgets.add({
        type: 'COMBO',
        name: 'sampler',
        options: { values: ['euler'] }
      })

      expect(added?.widgetType).toBe('combo')
      const widget = node.widgets?.[0]
      assert(widget)
      expect(isComboWidget(widget)).toBe(true)
      expect(() =>
        widgets.add({ type: 'Combo', name: 'other', options: {} })
      ).toThrow(TypeError)
    })

    it('records the addition as one change', () => {
      const { node, widgets } = nodeWith()
      probe = () => node.widgets?.length ?? 0

      widgets.add({ type: 'number', name: 'steps', value: 20 })

      expect(changes).toEqual([
        ['start', 0],
        ['end', 1]
      ])
    })

    it('grows the node to fit the widget it adds', () => {
      const { node, widgets } = nodeWith()
      const before = node.size[1]

      for (const name of ['a', 'b', 'c', 'd']) {
        widgets.add({ type: 'number', name, value: 1 })
      }

      expect(node.size[1]).toBeGreaterThan(before)
    })

    it('applies the flags a definition gives', () => {
      const { node, widgets } = nodeWith()

      const added = widgets.add({
        type: 'text',
        name: 'note',
        value: 'hello',
        serialize: false,
        disabled: true,
        hidden: true
      })

      expect(added?.isSerialized()).toBe(false)
      expect(added?.isDisabled()).toBe(true)
      expect(added?.isHidden()).toBe(true)
      expect(node.serialize().widgets_values).toEqual([])
    })

    it('keeps a copy of the value and options, so the pack’s objects cannot change it', () => {
      const { widgets } = nodeWith()
      const options = { values: ['a', 'b'] }
      const value = { list: [1] }

      const added = widgets.add({
        type: 'custom',
        name: 'data',
        value,
        options
      })
      options.values.push('c')
      value.list.push(2)

      expect(added?.getOptions()?.values).toEqual(['a', 'b'])
      expect(added?.getValue()).toEqual({ list: [1] })
    })

    it('names add in a refusal of its definition', () => {
      const { widgets } = nodeWith()

      expect(() => Reflect.apply(widgets.add, widgets, ['number'])).toThrow(
        "add needs a widget definition as a plain object, not 'number'."
      )
    })

    it('refuses a name any of several widgets of the node has', () => {
      const { node, widgets } = nodeWith('seed', 'steps', 'cfg')

      expect(() => widgets.add({ type: 'number', name: 'steps' })).toThrow(
        "add needs a name no widget of the node has, not 'steps'."
      )
      expect(node.widgets).toHaveLength(3)
    })

    it('refuses a name the node already has, and adds nothing', () => {
      const { node, widgets } = nodeWith('seed')

      expect(() => widgets.add({ type: 'number', name: 'seed' })).toThrow(
        "add needs a name no widget of the node has, not 'seed'."
      )
      expect(node.widgets).toHaveLength(1)
      expect(changes).toEqual([])
    })

    it.for([
      ['not an object', 'number'],
      ['an unknown field', { type: 'number', name: 'x', label: 'X' }],
      ['no type', { name: 'x' }],
      ['a name that is not text', { type: 'number', name: 1 }],
      [
        'a function among the options of a widget that is not a combo',
        { type: 'number', name: 'x', options: { values: () => [1] } }
      ],
      [
        'a value it cannot save',
        { type: 'number', name: 'x', value: Infinity }
      ],
      [
        'options that are not an object',
        { type: 'number', name: 'x', options: [] }
      ],
      [
        'an option it cannot save',
        { type: 'number', name: 'x', options: { format: () => '' } }
      ],
      [
        'a flag that is not a boolean',
        { type: 'number', name: 'x', hidden: 1 }
      ],
      [
        'a combo whose values are not a list',
        { type: 'combo', name: 'x', options: { values: 'a,b' } }
      ],
      [
        'a combo with a function among its other options',
        {
          type: 'combo',
          name: 'x',
          options: { values: () => ['a'], label: () => 'A' }
        }
      ],
      ['a combo without values', { type: 'combo', name: 'x', options: {} }],
      ['a combo without options', { type: 'combo', name: 'x' }]
    ] as const)('refuses a definition with %s, and adds nothing', ([, def]) => {
      const { node, widgets } = nodeWith('seed')

      expect(() => Reflect.apply(widgets.add, widgets, [def])).toThrow(
        TypeError
      )
      expect(node.widgets?.map(({ name }) => name)).toEqual(['seed'])
    })

    it('adds a widget with an empty name, which the host keeps and saves', () => {
      const { node, widgets } = nodeWith('seed')

      const handle = widgets.add({ type: 'number', name: '', value: 4 })

      expect(handle).toBe(widgets.get(''))
      expect(handle?.getValue()).toBe(4)
      expect(node.widgets?.map(({ name }) => name)).toEqual(['seed', ''])
      expect(node.serialize().widgets_values).toEqual([1, 4])
      expect(() => widgets.add({ type: 'number', name: '' })).toThrow(
        "add needs a name no widget of the node has, not ''."
      )
    })

    describe('a combo whose values come from a function', () => {
      function comboWith(values: () => unknown) {
        const { node, widgets } = nodeWith()
        const handle = widgets.add({
          type: 'combo',
          name: 'choice',
          value: 'a',
          options: { values, max: 2 }
        })
        const widget = node.widgets?.[0]
        assert(handle && widget && isComboWidget(widget))
        return { handle, widget }
      }

      it('lists what the function returns, calling it with nothing of the host', () => {
        const values = vi.fn(() => ['a', 2])
        const { handle, widget } = comboWith(values)

        expect(resolveComboValues(widget)).toEqual(['a', 2])
        expect(values).toHaveBeenCalledExactlyOnceWith()
        expect(widget.options.max).toBe(2)
        expect(handle.getOptions()).toEqual({ max: 2 })
      })

      it('lists what a getter of values returns, each time the host reads them', () => {
        const { node, widgets } = nodeWith()
        const listed = [['a'], ['a', 'b']]
        const options = { max: 2 }
        Object.defineProperty(options, 'values', {
          get: () => listed.shift(),
          enumerable: true
        })
        widgets.add({ type: 'combo', name: 'choice', value: 'a', options })
        const widget = node.widgets?.[0]
        assert(widget && isComboWidget(widget))

        expect(resolveComboValues(widget)).toEqual(['a'])
        expect(resolveComboValues(widget)).toEqual(['a', 'b'])
        expect(widget.options.max).toBe(2)
      })

      it('reads a getter of values on the options object the pack gave', () => {
        const { node, widgets } = nodeWith()
        widgets.add({
          type: 'combo',
          name: 'choice',
          value: 'x',
          options: {
            choices: ['x', 'y'],
            get values() {
              return this.choices
            }
          }
        })
        const widget = node.widgets?.[0]
        assert(widget && isComboWidget(widget))

        expect(resolveComboValues(widget)).toEqual(['x', 'y'])
      })

      const throwing = (): unknown => {
        throw new Error('no list')
      }

      it.for([
        ['throws', throwing],
        ['returns no list', (): unknown => 'a'],
        ['returns a list of other things', (): unknown => ['a', { b: 1 }]]
      ] as const)(
        'reports a function that %s, and lists nothing',
        ([, values]) => {
          const { widget } = comboWith(values)

          expect(resolveComboValues(widget)).toEqual([])
          expect(reportError).toHaveBeenCalledOnce()
        }
      )
    })

    it.for([
      [{ value: [1, Number.NaN] }, 'value[1]', 'NaN'],
      [{ options: { format: () => '' } }, 'options.format', 'a function'],
      [
        { options: { steps: [1, { at: Infinity }] } },
        'options.steps[1].at',
        'Infinity'
      ]
    ] as const)(
      'names the field of a definition it cannot save, and what it found there: %o',
      ([fields, part, found]) => {
        const { widgets } = nodeWith()

        expect(() =>
          widgets.add({ type: 'number', name: 'x', ...fields })
        ).toThrow(
          `add needs ${part} as a string, a finite number, a boolean, null, or a plain object or array of those, not ${found}.`
        )
      }
    )
  })

  it('applies an edit when the host records no changes', () => {
    const { comfy: unrecorded } = createComfyApi({ getGraph: () => graph })
    const { node } = nodeWith('seed')

    unrecorded.graph.node(String(node.id))?.widgets.remove('seed')

    expect(node.widgets).toHaveLength(0)
  })

  describe('remove', () => {
    it('removes the widget, and its handle reads as deleted', () => {
      const { node, widgets } = nodeWith('seed', 'steps')
      const seed = widgets.get('seed')

      expect(widgets.remove('seed')).toBe(true)

      expect(node.widgets?.map(({ name }) => name)).toEqual(['steps'])
      expect(storedOrder(node)).toEqual(['steps'])
      expect(seed?.isDeleted).toBe(true)
      expect(changes).toHaveLength(2)
    })

    it('says so when the node has no widget by that name', () => {
      const { widgets } = nodeWith('seed')

      expect(widgets.remove('steps')).toBe(false)
      expect(changes).toEqual([])
    })
  })

  describe('order', () => {
    it('accepts an empty order for a node without widgets', () => {
      const { node, widgets } = nodeWith()

      widgets.reorder([])

      expect(node.widgets).toBeUndefined()
    })

    it('reorders the widgets, on the node and in the store the Vue canvas draws from', () => {
      const { node, widgets } = nodeWith('a', 'b', 'c')

      widgets.reorder(['c', 'a', 'b'])

      expect(widgets.names()).toEqual(['c', 'a', 'b'])
      expect(storedOrder(node)).toEqual(['c', 'a', 'b'])
      expect(changes).toHaveLength(2)
    })

    it.for([
      ['a name missing', ['a', 'b']],
      ['a name the node lacks', ['a', 'b', 'd']],
      ['a name twice', ['a', 'b', 'b']],
      ['a name too many', ['a', 'b', 'c', 'c']],
      ['not names', ['a', 'b', 3]],
      ['not a list', 'a,b,c']
    ] as const)(
      'refuses an order with %s, and changes nothing',
      ([, names]) => {
        const { node, widgets } = nodeWith('a', 'b', 'c')

        expect(() => Reflect.apply(widgets.reorder, widgets, [names])).toThrow(
          TypeError
        )
        expect(node.widgets?.map(({ name }) => name)).toEqual(['a', 'b', 'c'])
        expect(changes).toEqual([])
      }
    )

    it.for([
      [0, ['c', 'a', 'b']],
      [1, ['a', 'c', 'b']],
      [9, ['a', 'b', 'c']]
    ] as const)(
      'moves a widget to %i, clamped to the list',
      ([index, order]) => {
        const { widgets } = nodeWith('a', 'b', 'c')

        expect(widgets.move('c', index)).toBe(true)
        expect(widgets.names()).toEqual(order)
      }
    )

    it.for([[-1], [-4]])('refuses the negative index %i', ([index]) => {
      const { widgets } = nodeWith('a', 'b', 'c')

      expect(() => widgets.move('c', index)).toThrow(
        `move needs a whole number of zero or more, not ${index}.`
      )
      expect(widgets.names()).toEqual(['a', 'b', 'c'])
    })

    it('moves a widget forward past the others', () => {
      const { widgets } = nodeWith('a', 'b', 'c')

      widgets.move('a', 1)

      expect(widgets.names()).toEqual(['b', 'a', 'c'])
    })

    it('does not move a widget the node lacks, and says so', () => {
      const { widgets } = nodeWith('a', 'b')

      expect(widgets.move('d', 0)).toBe(false)
      expect(widgets.names()).toEqual(['a', 'b'])
    })

    it.for([
      ['a name that is not a string', 1, 0, 'move needs a widget name'],
      ['an index that is not whole', 'a', 1.5, 'move needs a whole number']
    ] as const)('refuses a move with %s', ([, name, index, message]) => {
      const { widgets } = nodeWith('a', 'b')

      expect(() => Reflect.apply(widgets.move, widgets, [name, index])).toThrow(
        message
      )
      expect(widgets.names()).toEqual(['a', 'b'])
    })
  })

  it('reaches a subgraph node’s widgets in its own graph, whichever graph is on screen', () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    const { node: rootNode } = nodeWith('rootWidget')
    const inner = new LGraphNode('Inner', 'TestNode')
    inner.id = rootNode.id
    subgraph.add(inner)
    inner.addWidget('number', 'innerWidget', 1, () => {}, {})
    const innerHandle = comfy.graph.subgraphs()[0]?.node(String(inner.id))
    assert(innerHandle)

    expect(innerHandle.widgets.names()).toEqual(['innerWidget'])
    expect(innerHandle.widgets.get('innerWidget')).not.toBe(
      comfy.graph.node(String(rootNode.id))?.widgets.get('rootWidget')
    )
  })
})
