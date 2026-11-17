import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useWidgetStore } from '@/stores/widgetStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type {
  DefRegistry,
  WidgetTypeContext,
  WidgetTypeDef,
  WidgetTypeValue
} from '@/platform/nodeApi/v4/types'

describe('declared widget types', () => {
  let graph: LGraph
  let widgetTypes: { define: DefRegistry['defineWidgetType'] }
  let changes: number

  beforeEach(() => {
    changes = 0
    graph = new LGraph()
    const { comfy } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => {
          changes++
        },
        afterChange: () => {}
      })
    })
    widgetTypes = { define: comfy.defs.defineWidgetType }
  })

  function buildInput(type: string, options: Record<string, unknown> = {}) {
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)
    const construct = useWidgetStore().widgets.get(type)
    assert(construct)
    const result = construct(node, 'color', [type, options], app)
    const widget = node.widgets?.[0]
    assert(widget)
    return { node, widget, result }
  }

  function defineRendering(def: Partial<WidgetTypeDef> = {}) {
    const rendered: {
      container?: HTMLElement
      value?: WidgetTypeValue
      name?: string
      context?: WidgetTypeContext
    } = {}
    const stop = widgetTypes.define('PACK_COLOR', {
      render: (container, value, name, context) => {
        Object.assign(rendered, { container, value, name, context })
      },
      ...def
    })
    return { rendered, stop }
  }

  it('makes an input of the type a widget, until the disposer runs', () => {
    const store = useWidgetStore()
    const { stop } = defineRendering()

    expect(store.inputIsWidget({ type: 'PACK_COLOR', name: 'color' })).toBe(
      true
    )

    stop()
    stop()

    expect(store.inputIsWidget({ type: 'PACK_COLOR', name: 'color' })).toBe(
      false
    )
  })

  it('renders each input with its element, value, name and declared options', () => {
    const { rendered } = defineRendering({ defaultValue: '#000000' })

    const { widget } = buildInput('PACK_COLOR', {
      default: '#ff0000',
      alpha: 1
    })

    expect(rendered.container).toBeInstanceOf(HTMLElement)
    expect(rendered.name).toBe('color')
    expect(rendered.value?.get()).toBe('#ff0000')
    expect(widget.value).toBe('#ff0000')
    const options = rendered.context?.getOptions()
    expect(options).toEqual({ default: '#ff0000', alpha: 1 })
    expect(Object.isFrozen(options)).toBe(true)
  })

  it.for([[null], [() => 3], [Number.NaN]])(
    'starts from the type’s default when the declaration gives none it can hold: %o',
    ([declared]) => {
      const { rendered } = defineRendering({ defaultValue: { r: 1 } })

      buildInput('PACK_COLOR', { default: declared })

      expect(rendered.value?.get()).toEqual({ r: 1 })
    }
  )

  it('starts from a number or boolean the declaration gives', () => {
    const { rendered } = defineRendering({ defaultValue: 0 })

    buildInput('PACK_COLOR', { default: 0.5 })

    expect(rendered.value?.get()).toBe(0.5)
  })

  it.for([
    [0, 0],
    [false, false],
    [null, '']
  ] as const)(
    'starts from a type default of %o, held as the host holds it',
    ([given, held]) => {
      const { rendered } = defineRendering({ defaultValue: given })

      const { node, widget } = buildInput('PACK_COLOR')
      node.serialize_widgets = true

      expect(rendered.value?.get()).toBe(held)
      expect(widget.value).toBe(held)
      expect(node.serialize().widgets_values).toEqual([held])
    }
  )

  it('starts from empty text with no default anywhere, and no options', () => {
    const { rendered } = defineRendering()
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)

    useWidgetStore().widgets.get('PACK_COLOR')?.(
      node,
      'color',
      ['PACK_COLOR'],
      app
    )

    expect(rendered.value?.get()).toBe('')
    expect(rendered.context?.getOptions()).toEqual({})
  })

  it('draws a placeholder at low zoom, as a mount does by default', () => {
    defineRendering()

    const { widget } = buildInput('PACK_COLOR')

    expect(widget.options).toMatchObject({ hideOnZoom: true })
  })

  it('commits a value the widget sets, as one change', () => {
    const { rendered } = defineRendering()
    const { widget } = buildInput('PACK_COLOR')
    changes = 0

    rendered.value?.set('#00ff00')

    expect(widget.value).toBe('#00ff00')
    expect(changes).toBe(1)
  })

  it('takes a value set while the node is being made, as no undo step', () => {
    widgetTypes.define('PACK_COLOR', {
      render: (_container, value) => value.set('#123456')
    })
    const node = new LGraphNode('Node', 'TestNode')
    const construct = useWidgetStore().widgets.get('PACK_COLOR')
    assert(construct)

    construct(node, 'color', ['PACK_COLOR', {}], app)

    expect(node.widgets?.[0]?.value).toBe('#123456')
    expect(changes).toBe(0)
  })

  it('saves and sends the value unless told not to', () => {
    defineRendering()
    const saved = buildInput('PACK_COLOR').widget
    widgetTypes.define('PACK_NOTE', { render: () => {}, serialize: false })
    const unsaved = buildInput('PACK_NOTE').widget

    expect([saved.serialize, saved.options.serialize]).toEqual([true, true])
    expect([unsaved.serialize, unsaved.options.serialize]).toEqual([
      false,
      false
    ])
  })

  it('gives the host the least height, and fixes a height when one is given', () => {
    defineRendering({ minHeight: 30, height: 80 })

    const { widget, result } = buildInput('PACK_COLOR')

    expect(result).toMatchObject({ minHeight: 30 })
    expect(widget.computeSize?.(100)).toEqual([100, 80])
  })

  it('runs the teardown render returned when the widget is released', () => {
    const teardown = vi.fn()
    widgetTypes.define('PACK_COLOR', { render: () => teardown })
    const { node, widget } = buildInput('PACK_COLOR')

    node.removeWidget(widget)

    expect(teardown).toHaveBeenCalledOnce()
  })

  it('reports a render that throws, and still builds the widget', () => {
    widgetTypes.define('PACK_COLOR', {
      render: () => {
        throw new Error('render failed')
      }
    })

    const { node } = buildInput('PACK_COLOR')

    expect(node.widgets).toHaveLength(1)
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('leaves a type another registration took over when disposed', () => {
    const { stop } = defineRendering()
    const store = useWidgetStore()
    const other = vi.fn()
    store.registerCustomWidgets({ PACK_COLOR: other })

    stop()

    expect(store.widgets.get('PACK_COLOR')).toBe(other)
  })

  it.for([
    ['an empty type', '', { render: () => {} }],
    ['a core type', 'INT', { render: () => {} }],
    ['no render', 'PACK_X', {}],
    ['a render that is not a function', 'PACK_X', { render: 'draw' }],
    ['an unknown field', 'PACK_X', { render: () => {}, minWidth: 3 }],
    [
      'a default it cannot save',
      'PACK_X',
      { render: () => {}, defaultValue: [Infinity] }
    ],
    ['a height that is not a size', 'PACK_X', { render: () => {}, height: -2 }],
    [
      'a flag that is not a boolean',
      'PACK_X',
      { render: () => {}, serialize: 1 }
    ]
  ] as const)('refuses %s, and registers nothing', ([, type, def]) => {
    expect(() =>
      Reflect.apply(widgetTypes.define, widgetTypes, [type, def])
    ).toThrow(TypeError)
    expect(useWidgetStore().widgets.has('PACK_X')).toBe(false)
  })

  it('refuses a type a pack already declared', () => {
    defineRendering()

    expect(() =>
      widgetTypes.define('PACK_COLOR', { render: () => {} })
    ).toThrow(
      "defineWidgetType needs a type no widget is defined for, not 'PACK_COLOR'."
    )
  })
})
