import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, WidgetHandle } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('widget handles', () => {
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

  function nodeWithWidget(
    type: 'number' | 'custom' = 'number',
    value: IBaseWidget['value'] = 1,
    options: Record<string, unknown> = {}
  ) {
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)
    const callback = vi.fn()
    node.addWidget(type, 'seed', value, callback, options)
    node.addWidget('number', 'steps', 20, () => {}, {})
    const widget = node.widgets?.[0]
    const handle = comfy.graph.node(String(node.id))?.widgets.get('seed')
    assert(widget && handle)
    return { node, widget, handle, callback }
  }

  describe('reads', () => {
    it('names the widget and reads its type and value', () => {
      const { widget, handle } = nodeWithWidget()

      expect(handle.name).toBe('seed')
      expect(handle.widgetType).toBe('number')
      expect(handle.isDeleted).toBe(false)
      expect(handle.getValue()).toBe(1)

      widget.value = 5

      expect(handle.getValue()).toBe(5)
    })

    it('gives a frozen copy of an object value', () => {
      const { widget, handle } = nodeWithWidget('custom', { list: [1, 2] })

      const value = handle.getValue()

      expect(value).toEqual({ list: [1, 2] })
      expect(value).not.toBe(widget.value)
      expect(Object.isFrozen(value)).toBe(true)
      expect(Object.isFrozen(Reflect.get(Object(value), 'list'))).toBe(true)
    })

    it('reads a value the workflow cannot save as undefined, and reports it once', () => {
      const circular: Record<string, unknown> = {}
      circular.itself = circular
      const { handle } = nodeWithWidget('custom', circular)

      expect(handle.getValue()).toBeUndefined()
      expect(handle.getValue()).toBeUndefined()
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('reads a widget with no value as null', () => {
      const { widget, handle } = nodeWithWidget()
      widget.value = undefined

      expect(widget.value).toBeUndefined()
      expect(handle.getValue()).toBeNull()
    })

    it('gives a frozen copy of the options, without those that are functions', () => {
      const { widget, handle } = nodeWithWidget('number', 1, {
        min: 0,
        max: 10,
        formatter: () => ''
      })

      const options = handle.getOptions()

      expect(options).toMatchObject({ min: 0, max: 10 })
      expect(options).not.toHaveProperty('formatter')
      expect(Object.isFrozen(options)).toBe(true)
      expect(options).not.toBe(widget.options)
    })

    it('reports the hidden, disabled and saved flags', () => {
      const { widget, handle } = nodeWithWidget()

      expect([
        handle.isHidden(),
        handle.isDisabled(),
        handle.isSerialized()
      ]).toEqual([false, false, true])

      widget.hidden = true
      widget.disabled = true
      widget.serialize = false

      expect([
        handle.isHidden(),
        handle.isDisabled(),
        handle.isSerialized()
      ]).toEqual([true, true, false])
    })

    it('cannot be changed by a pack', () => {
      const { handle } = nodeWithWidget()

      expect(Object.isFrozen(handle)).toBe(true)
    })
  })

  describe('setValue', () => {
    it('commits as a user’s edit does: callback, node hook, and a new graph version', () => {
      const { node, widget, handle, callback } = nodeWithWidget()
      const onWidgetChanged = vi.fn()
      node.onWidgetChanged = onWidgetChanged
      const version = graph._version

      expect(handle.setValue(7)).toBe(true)
      expect(widget.value).toBe(7)
      expect(callback).toHaveBeenCalledWith(
        7,
        undefined,
        node,
        undefined,
        undefined
      )
      expect(onWidgetChanged).toHaveBeenCalledWith('seed', 7, 1, widget)
      expect(graph._version).toBeGreaterThan(version)
    })

    it('records the commit as one change', () => {
      const { widget, handle } = nodeWithWidget()
      probe = () => widget.value

      handle.setValue(7)

      expect(changes).toEqual([
        ['start', 1],
        ['end', 7]
      ])
    })

    it('writes a value bound to a node property through to the property', () => {
      const node = new LGraphNode('Node', 'TestNode')
      graph.add(node)
      node.properties.amount = 1
      node.addWidget('number', 'amount', 1, null, { property: 'amount' })
      const handle = comfy.graph.node(String(node.id))?.widgets.get('amount')

      handle?.setValue(4)

      expect(node.properties.amount).toBe(4)
    })

    it('keeps a copy of an object value, so the pack’s object cannot change it', () => {
      const { widget, handle } = nodeWithWidget('custom', {})
      const value = { list: [1] }

      handle.setValue(value)
      value.list.push(2)

      expect(widget.value).toEqual({ list: [1] })
    })

    it.for([
      [Number.NaN],
      [Infinity],
      [undefined],
      [() => 1],
      [Symbol('x')],
      [10n],
      [new Date(0)],
      [{ nested: Number.NaN }],
      [[1, undefined]]
    ])(
      'refuses a value the workflow cannot save, and changes nothing: %o',
      ([value]) => {
        const { widget, handle, callback } = nodeWithWidget()

        expect(() => Reflect.apply(handle.setValue, handle, [value])).toThrow(
          /^setValue needs value(\.nested|\[1\])? as a string, a finite number, a boolean, null/
        )
        expect(widget.value).toBe(1)
        expect(callback).not.toHaveBeenCalled()
        expect(changes).toEqual([])
      }
    )

    it.for([
      [{ nested: Number.NaN }, 'value.nested', 'NaN'],
      [[1, undefined], 'value[1]', 'undefined'],
      [
        { list: [{ when: new Date(0) }] },
        'value.list[0].when',
        'an instance of Date'
      ]
    ] as const)(
      'names the part of a value it cannot save, and what it found there: %o',
      ([value, part, found]) => {
        const { handle } = nodeWithWidget()

        expect(() => handle.setValue(value)).toThrow(
          `setValue needs ${part} as a string, a finite number, a boolean, null, or a plain object or array of those, not ${found}.`
        )
      }
    )

    it('refuses a value that contains itself, naming where', () => {
      const { handle } = nodeWithWidget('custom', {})
      const circular: Record<string, unknown> = {}
      circular.itself = circular

      expect(() => handle.setValue(circular)).toThrow(
        /^setValue needs value\.itself as a string/
      )
    })

    it('refuses a value with a getter without calling it, and changes nothing', () => {
      const { widget, handle } = nodeWithWidget()
      const read = vi.fn(() => 'savable')
      const value = {}
      Object.defineProperty(value, 'field', { get: read, enumerable: true })

      expect(() => handle.setValue(value)).toThrow(
        /^setValue needs value\.field as a string.*, not a function\.$/
      )
      expect(read).not.toHaveBeenCalled()
      expect(widget.value).toBe(1)
    })

    it('accepts a value with a getter it does not save, as a copy without it', () => {
      const { widget, handle } = nodeWithWidget('custom', {})
      const read = vi.fn(() => 'hidden')
      const value = { kept: 'a' }
      Object.defineProperty(value, 'hidden', { get: read, enumerable: false })

      handle.setValue(value)

      expect(widget.value).toEqual({ kept: 'a' })
      expect(read).not.toHaveBeenCalled()
    })

    it('accepts null and a list as values', () => {
      const { widget, handle } = nodeWithWidget('custom', {})

      handle.setValue(null)

      expect(widget.value).toBeNull()

      handle.setValue([1, 'two', true, { three: null }])

      expect(widget.value).toEqual([1, 'two', true, { three: null }])
    })

    it('redraws after a commit', () => {
      const { handle } = nodeWithWidget()
      const setDirtyCanvas = vi.spyOn(graph, 'setDirtyCanvas')

      handle.setValue(9)

      expect(setDirtyCanvas).toHaveBeenCalledWith(true, true)
    })

    it('accepts an object that refers to one value twice', () => {
      const { widget, handle } = nodeWithWidget('custom', {})
      const shared = { x: 1 }

      handle.setValue({ first: shared, second: shared })

      expect(widget.value).toEqual({ first: { x: 1 }, second: { x: 1 } })
    })
  })

  describe('display', () => {
    it('sets an option, and reads it back', () => {
      const { widget, handle } = nodeWithWidget()

      handle.setOption('max', 50)
      handle.setOption('values', ['a', 'b'])

      expect(widget.options.max).toBe(50)
      expect(handle.getOptions()).toMatchObject({ max: 50, values: ['a', 'b'] })
    })

    it('hides the widget when the hidden option is set, as the host reads it', () => {
      const { handle } = nodeWithWidget()

      handle.setOption('hidden', true)

      expect(handle.isHidden()).toBe(true)
    })

    it.for([[''], ['__proto__'], ['constructor'], ['toString'], [1]])(
      'refuses an option name it cannot use: %o',
      ([key]) => {
        const { widget, handle } = nodeWithWidget()

        expect(() => Reflect.apply(handle.setOption, handle, [key, 1])).toThrow(
          'setOption needs an option name'
        )
        expect(Object.getPrototypeOf(widget.options)).toBe(Object.prototype)
      }
    )

    it('refuses an option value the workflow cannot save', () => {
      const { widget, handle } = nodeWithWidget()

      expect(() =>
        Reflect.apply(handle.setOption, handle, ['max', () => 1])
      ).toThrow(
        /^setOption needs options\.max as a string.*, not a function\.$/
      )
      expect(widget.options.max).toBeUndefined()
    })

    it('sets the label', () => {
      const { widget, handle } = nodeWithWidget()

      handle.setLabel('Seed value')

      expect(widget.label).toBe('Seed value')
      expect(() => Reflect.apply(handle.setLabel, handle, [3])).toThrow(
        'setLabel needs a label'
      )
    })

    it('hides and shows the widget with the widgets linked to it, once each', () => {
      const { node, widget, handle } = nodeWithWidget()
      const steps = node.widgets?.[1]
      assert(steps)
      widget.linkedWidgets = [steps]
      steps.linkedWidgets = [widget]

      handle.setHidden(true)

      expect([widget.hidden, steps.hidden]).toEqual([true, true])

      handle.setHidden(false)

      expect([widget.hidden, steps.hidden]).toEqual([false, false])
    })

    it('disables the widget', () => {
      const { widget, handle } = nodeWithWidget()

      handle.setDisabled(true)

      expect(widget.disabled).toBe(true)
      expect(handle.isDisabled()).toBe(true)
    })

    it.for([['setHidden'], ['setDisabled']] as const)(
      '%s refuses anything but true or false',
      ([member]) => {
        const { handle } = nodeWithWidget()

        expect(() => Reflect.apply(handle[member], handle, ['yes'])).toThrow(
          `${member} needs true or false`
        )
      }
    )

    it('fixes the height the widget takes on its node, and grows the node to fit', () => {
      const { node, widget, handle } = nodeWithWidget()
      const before = node.size[1]

      handle.setHeight(300)

      expect(widget.computeSize?.(120)).toEqual([120, 300])
      expect(widget.computeSize?.()).toEqual([0, 300])
      expect(node.size[1]).toBeGreaterThan(before + 200)
    })

    it('is one undo step, since the node it grows is saved', () => {
      const { node, handle } = nodeWithWidget()
      probe = () => node.size[1]
      const before = node.size[1]

      handle.setHeight(300)

      expect(changes).toEqual([
        ['start', before],
        ['end', node.size[1]]
      ])
    })

    it.for([[-1], [Number.NaN], [Infinity], ['20']])(
      'refuses a height it cannot use: %o',
      ([height]) => {
        const { widget, handle } = nodeWithWidget()

        expect(() => Reflect.apply(handle.setHeight, handle, [height])).toThrow(
          'setHeight needs a finite size of 0 or more'
        )
        expect(widget.computeSize).toBeUndefined()
      }
    )

    it('changes no saved state, so it records no change, and redraws both canvas layers', () => {
      const { node, handle } = nodeWithWidget()
      const setDirtyCanvas = vi.spyOn(node, 'setDirtyCanvas')

      handle.setLabel('Seed')
      handle.setOption('max', 3)
      handle.setHidden(true)
      handle.setDisabled(true)

      expect(changes).toEqual([])
      expect(setDirtyCanvas.mock.calls).toEqual(Array(4).fill([true, true]))
    })
  })

  describe('linked widgets', () => {
    it('reads the linked widgets that are on the node, as handles', () => {
      const { node, widget, handle } = nodeWithWidget()
      const steps = node.widgets?.[1]
      const elsewhere = new LGraphNode('Other', 'TestNode')
      const stray = elsewhere.addWidget('number', 'stray', 1, () => {}, {})
      assert(steps)
      widget.linkedWidgets = [steps, stray]

      const linked = handle.linked()

      expect(linked).toEqual([
        comfy.graph.node(String(node.id))?.widgets.get('steps')
      ])
      expect(Object.isFrozen(linked)).toBe(true)
    })

    it('reads no linked widgets for a widget that has none', () => {
      const { handle } = nodeWithWidget()

      expect(handle.linked()).toEqual([])
    })

    it('links other widgets of the node by name, replacing earlier links', () => {
      const { node, widget, handle } = nodeWithWidget()
      node.addWidget('number', 'cfg', 7, () => {}, {})

      handle.setLinked(['steps'])
      handle.setLinked(['cfg'])

      expect(widget.linkedWidgets?.map(({ name }) => name)).toEqual(['cfg'])
      expect(handle.linked()?.map(({ name }) => name)).toEqual(['cfg'])

      handle.setLinked([])

      expect(handle.linked()).toEqual([])
    })

    it('names what it needs when the list holds something else', () => {
      const { handle } = nodeWithWidget()

      expect(() =>
        Reflect.apply(handle.setLinked, handle, [['steps', 3]])
      ).toThrow('setLinked needs an array of widget names')
    })

    it.for([
      ['a name the node lacks', ['missing']],
      ['the widget itself', ['seed']],
      ['a list of something else', [3]],
      ['not a list', 'steps']
    ] as const)('refuses to link %s, and keeps the links', ([, names]) => {
      const { node, widget, handle } = nodeWithWidget()
      const steps = node.widgets?.[1]
      assert(steps)
      widget.linkedWidgets = [steps]

      expectRefusal(
        () => Reflect.apply(handle.setLinked, handle, [names]),
        'setLinked'
      )
      expect(widget.linkedWidgets).toEqual([steps])
    })
  })

  describe('lifetime', () => {
    function expectGone(handle: WidgetHandle) {
      expect(handle.isDeleted).toBe(true)
      expect(handle.name).toBe('seed')
      expect(handle.widgetType).toBeUndefined()
      expect(handle.getValue()).toBeUndefined()
      expect(handle.getOptions()).toBeUndefined()
      expect(handle.isHidden()).toBeUndefined()
      expect(handle.isDisabled()).toBeUndefined()
      expect(handle.isSerialized()).toBeUndefined()
      expect(handle.linked()).toBeUndefined()
    }

    it('reads nothing and changes nothing once its widget is removed', () => {
      const { node, widget, handle, callback } = nodeWithWidget()
      node.removeWidget(widget)

      expectGone(handle)
      expect([
        handle.setValue(9),
        handle.setOption('max', 1),
        handle.setLabel('x'),
        handle.setHidden(true),
        handle.setDisabled(true),
        handle.setHeight(4),
        handle.setLinked(['steps'])
      ]).toEqual([false, false, false, false, false, false, false])
      expect(callback).not.toHaveBeenCalled()
      expect(widget.value).toBe(1)
      expect(changes).toEqual([])
    })

    it('reads nothing once its node is removed', () => {
      const { node, handle } = nodeWithWidget()

      graph.remove(node)

      expectGone(handle)
    })

    it('reaches a widget added again under its name, until an undo or redo finishes', () => {
      const { node, widget, handle } = nodeWithWidget()
      node.removeWidget(widget)
      node.addWidget('number', 'seed', 3, () => {}, {})

      expect(handle.getValue()).toBe(3)

      node.removeWidget(node.widgets?.[1] ?? widget)
      host.afterHistoryRestore()
      node.addWidget('number', 'seed', 4, () => {}, {})

      expectGone(handle)
      expect(
        comfy.graph.node(String(node.id))?.widgets.get('seed')?.getValue()
      ).toBe(4)
    })

    it('keeps a handle through an undo whose rebuilt node still has the widget', () => {
      LiteGraph.registerNodeType(
        'WidgetNode',
        class extends LGraphNode {
          constructor() {
            super('Widget node')
            this.addWidget('number', 'seed', 1, () => {}, {})
          }
        }
      )
      const node = LiteGraph.createNode('WidgetNode')
      assert(node)
      graph.add(node)
      const handle = comfy.graph.node(String(node.id))?.widgets.get('seed')

      graph.configure(graph.serialize())
      host.afterHistoryRestore()
      const rebuilt = graph.getNodeById(node.id)?.widgets?.[0]
      assert(rebuilt)
      rebuilt.value = 6

      expect(rebuilt).not.toBe(node.widgets?.[0])
      expect(handle?.isDeleted).toBe(false)
      expect(handle?.getValue()).toBe(6)
    })

    it('is retired when another document loads', () => {
      const { node, handle } = nodeWithWidget()
      const sameId = new LGraphNode('Other', 'TestNode')
      sameId.id = node.id
      sameId.addWidget('number', 'seed', 8, () => {}, {})

      graph.remove(node)
      host.beginDocument()
      graph.add(sameId)

      expectGone(handle)
    })

    it('still refuses an argument it cannot use once deleted', () => {
      const { node, handle } = nodeWithWidget()
      graph.remove(node)

      expectRefusal(
        () => Reflect.apply(handle.setValue, handle, [Number.NaN]),
        'setValue'
      )
      expectRefusal(
        () => Reflect.apply(handle.setLabel, handle, [1]),
        'setLabel'
      )
    })
  })
})
