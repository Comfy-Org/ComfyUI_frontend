import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LiteGraph, isComboWidget } from '@/lib/litegraph/src/litegraph'
import { resolveComboValues } from '@/utils/litegraphUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeDefBuilder } from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

let typeCount = 0
let TYPE = ''

describe('widgets in node definitions', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    TYPE = `Pack/WithWidgets${++typeCount}`
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    comfy = api.comfy
    registerHostType(api.host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function added(type = TYPE): LGraphNode {
    const node = LiteGraph.createNode(type)
    assert(node)
    graph.add(node)
    return node
  }

  function widgetsOf(node: LGraphNode) {
    const widgets = comfy.graph.node(String(node.id))?.widgets
    assert(widgets)
    return widgets
  }

  describe('addWidget', () => {
    it('adds the widget to each node of the type as it is made', () => {
      comfy.defs.extend(TYPE, (builder) =>
        builder.addWidget({ type: 'number', name: 'steps', value: 20 })
      )

      const first = widgetsOf(added())
      const second = widgetsOf(added())

      expect(first.get('steps')?.getValue()).toBe(20)
      expect(second.names()).toEqual(['steps'])
    })

    it('reports a widget a node already has, and adds the others', () => {
      comfy.defs.extend(TYPE, (builder) => {
        builder.addWidget({ type: 'number', name: 'steps' })
        builder.addWidget({ type: 'number', name: 'steps' })
        builder.addWidget({ type: 'number', name: 'cfg' })
      })

      expect(widgetsOf(added()).names()).toEqual(['steps', 'cfg'])
      expect(reportError).toHaveBeenCalledOnce()
    })

    it.for([
      ['not an object', 'steps', 'addWidget needs a definition object'],
      [
        'an unknown field',
        { type: 'number', name: 's', label: 'S' },
        'addWidget needs a definition of'
      ]
    ] as const)('refuses a definition with %s', ([, def, message]) => {
      let refusal: unknown
      comfy.defs.extend(TYPE, (builder) => {
        try {
          Reflect.apply(builder.addWidget, builder, [def])
        } catch (error) {
          refusal = error
        }
      })

      expect(refusal).toBeInstanceOf(TypeError)
      expect(String(refusal)).toContain(message)
    })
  })

  it('gives back the values of widgets reordered in onCreated when the graph is rebuilt from its saved state', () => {
    comfy.defs.extend(TYPE, (builder) => {
      builder.addWidget({ type: 'number', name: 'a', value: 1 })
      builder.addWidget({ type: 'number', name: 'b', value: 2 })
      builder.onCreated((node) => node.widgets.reorder(['b', 'a']))
    })
    const node = added()
    node.serialize_widgets = true
    widgetsOf(node).get('a')?.setValue(10)
    widgetsOf(node).get('b')?.setValue(20)

    graph.configure(graph.serialize())
    const rebuilt = graph.getNodeById(node.id)
    assert(rebuilt)

    expect(widgetsOf(rebuilt).names()).toEqual(['b', 'a'])
    expect(widgetsOf(rebuilt).get('a')?.getValue()).toBe(10)
    expect(widgetsOf(rebuilt).get('b')?.getValue()).toBe(20)
  })

  describe('hideWidget', () => {
    it('hides the named widget on each node of the type as it is made', () => {
      comfy.defs.extend(TYPE, (builder) => {
        builder.addWidget({ type: 'number', name: 'index', value: 0 })
        builder.hideWidget('index')
        builder.hideWidget('missing')
      })

      expect(widgetsOf(added()).get('index')?.isHidden()).toBe(true)
      expect(reportError).not.toHaveBeenCalled()
    })

    it('hides a widget with an empty name, as add and get take one', () => {
      comfy.defs.extend(TYPE, (builder) => {
        builder.addWidget({ type: 'number', name: '', value: 0 })
        builder.hideWidget('')
      })

      expect(widgetsOf(added()).get('')?.isHidden()).toBe(true)
    })

    it.for([[3], [undefined]])(
      'refuses a name that is not one: %o',
      ([name]) => {
        let refusal: unknown
        comfy.defs.extend(TYPE, (builder) => {
          try {
            Reflect.apply(builder.hideWidget, builder, [name])
          } catch (error) {
            refusal = error
          }
        })

        expect(String(refusal)).toContain('hideWidget needs a widget name')
      }
    )
  })

  it('refuses either member once extend has returned, naming it', () => {
    let kept: NodeDefBuilder | undefined
    comfy.defs.extend(TYPE, (builder) => {
      kept = builder
    })
    assert(kept)
    const builder = kept

    expect(() => builder.addWidget({ type: 'number', name: 'x' })).toThrow(
      'addWidget can only be called inside the callback given to extend.'
    )
    expect(() => builder.hideWidget('x')).toThrow(
      'hideWidget can only be called inside the callback given to extend.'
    )
  })

  describe('a defined type', () => {
    it('gives each of its nodes the widgets it declares, in order', () => {
      comfy.defs.define({
        type: `${TYPE}/Defined`,
        widgets: [
          {
            type: 'combo',
            name: 'mode',
            value: 'a',
            options: { values: ['a', 'b'] }
          },
          { type: 'toggle', name: 'enabled', value: true }
        ]
      })

      const widgets = widgetsOf(added(`${TYPE}/Defined`))

      expect(widgets.names()).toEqual(['mode', 'enabled'])
      expect(widgets.get('enabled')?.getValue()).toBe(true)
    })

    it('takes a widget with an empty name and a combo whose values come from a function', () => {
      comfy.defs.define({
        type: `${TYPE}/Defined`,
        widgets: [
          { type: 'text', name: '', value: 'shown' },
          {
            type: 'combo',
            name: 'choice',
            value: 'a',
            options: { values: () => ['a', 'b'] }
          }
        ]
      })

      const node = added(`${TYPE}/Defined`)
      const widgets = widgetsOf(node)

      expect(widgets.names()).toEqual(['', 'choice'])
      expect(widgets.get('')?.getValue()).toBe('shown')
      const combo = node.widgets?.find(({ name }) => name === 'choice')
      assert(combo && isComboWidget(combo))
      expect(resolveComboValues(combo)).toEqual(['a', 'b'])
    })

    it.for([
      [
        'widgets that are not a list',
        { type: 'T', widgets: {} },
        'define needs a list of widgets'
      ],
      [
        'a widget without a name',
        { type: 'T', widgets: [{ type: 'number' }] },
        'define needs a widget name as text'
      ],
      [
        'a function among a widget’s options',
        {
          type: 'T',
          widgets: [{ type: 'number', name: 'n', options: { step: () => 1 } }]
        },
        'define needs options.step as a string'
      ]
    ] as const)(
      'refuses %s, and registers nothing',
      ([, definition, message]) => {
        expect(() =>
          Reflect.apply(comfy.defs.define, comfy.defs, [definition])
        ).toThrow(message)
        expect(comfy.defs.has('T')).toBe(false)
      }
    )
  })
})
