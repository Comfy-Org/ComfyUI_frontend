import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type {
  Comfy,
  MountDef,
  MountedValue,
  WidgetCollection
} from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('mounted widgets', () => {
  let graph: LGraph
  let comfy: Comfy
  let changes: number
  const history = {
    beforeChange: () => {
      changes++
    },
    afterChange: () => {}
  }

  beforeEach(() => {
    changes = 0
    graph = new LGraph()
    ;({ comfy } = createComfyApi({
      getGraph: () => graph,
      history: () => history
    }))
  })

  function node() {
    const added = new LGraphNode('Node', 'TestNode')
    added.comfyClass = 'TestNode'
    added.serialize_widgets = true
    graph.add(added)
    const widgets = comfy.graph.node(String(added.id))?.widgets
    assert(widgets)
    return { node: added, widgets }
  }

  function mount(widgets: WidgetCollection, def: Partial<MountDef> = {}) {
    let rendered: { container: HTMLElement; value: MountedValue } | undefined
    const handle = widgets.mount({
      name: 'panel',
      render: (container, value) => {
        rendered = { container, value }
      },
      ...def
    })
    assert(handle && rendered)
    return { handle, ...rendered }
  }

  it('hands the pack the widget’s element on its node, once', () => {
    const { node: added, widgets } = node()
    const render = vi.fn()

    const handle = widgets.mount({ name: 'panel', render })

    const widget = added.widgets?.[0]
    assert(widget && isDOMWidget(widget))
    expect(render).toHaveBeenCalledOnce()
    expect(render.mock.calls[0]?.[0]).toBe(widget.element)
    expect(handle).toBe(widgets.get('panel'))
    expect(handle?.widgetType).toBe('custom')
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(true)
    expect(changes).toBe(1)
  })

  it('saves and sends nothing for a widget without a value, and hides at low zoom', () => {
    const { node: added, widgets } = node()

    const { handle } = mount(widgets)

    expect(handle.isSerialized()).toBe(false)
    expect(added.widgets?.[0]?.options).toMatchObject({
      serialize: false,
      hideOnZoom: true
    })
  })

  it('saves and sends the value of a widget with a default', async () => {
    const { node: added, widgets } = node()

    const { handle, value } = mount(widgets, { defaultValue: { text: 'a' } })

    expect(value.get()).toEqual({ text: 'a' })
    expect(handle.isSerialized()).toBe(true)
    expect(added.serialize().widgets_values).toEqual([{ text: 'a' }])
    const { output } = await graphToPrompt(graph)
    expect(Object.values(output)[0]?.inputs).toEqual({
      panel: { text: 'a' }
    })
  })

  it('keeps a value saved but out of the prompt when asked', async () => {
    const { node: added, widgets } = node()

    mount(widgets, {
      defaultValue: 'kept',
      sendToPrompt: false,
      hideOnZoom: false
    })

    expect(added.serialize().widgets_values).toEqual(['kept'])
    expect(added.widgets?.[0]?.options).toMatchObject({ hideOnZoom: false })
    const { output } = await graphToPrompt(graph)
    expect(Object.values(output)[0]?.inputs).toEqual({})
  })

  it('sends a value it does not save when asked', async () => {
    const { node: added, widgets } = node()

    mount(widgets, {
      defaultValue: 'sent',
      serialize: false,
      sendToPrompt: true
    })

    expect(added.serialize().widgets_values).toEqual([])
    const { output } = await graphToPrompt(graph)
    expect(Object.values(output)[0]?.inputs).toEqual({ panel: 'sent' })
  })

  it('commits a value the pack sets as setValue does, without telling its own onChange', () => {
    const { widgets } = node()
    const { handle, value } = mount(widgets, { defaultValue: '' })
    const onChange = vi.fn()
    const changed = vi.fn()
    value.onChange(onChange)
    handle.on('change', changed)
    changes = 0

    value.set('typed')

    expect(value.get()).toBe('typed')
    expect(handle.getValue()).toBe('typed')
    expect(changed).toHaveBeenCalledWith('typed', '')
    expect(onChange).not.toHaveBeenCalled()
    expect(changes).toBe(1)
  })

  it('tells onChange of a write elsewhere after the pack set a value itself', () => {
    const { node: added, widgets } = node()
    const { value } = mount(widgets, { defaultValue: 'a' })
    const onChange = vi.fn()
    value.onChange(onChange)
    const widget = added.widgets?.[0]
    assert(widget)

    value.set('b')
    widget.value = 'c'

    expect(onChange).toHaveBeenCalledExactlyOnceWith('c')
  })

  it('tells onChange when the value is written elsewhere, as a load does', () => {
    const { node: added, widgets } = node()
    const { value } = mount(widgets, { defaultValue: { n: 1 } })
    const onChange = vi.fn()
    const stop = value.onChange(onChange)
    const widget = added.widgets?.[0]
    assert(widget)

    widget.value = { n: 2 }
    stop()
    stop()
    widget.value = { n: 3 }

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ n: 2 })
    expect(Object.isFrozen(onChange.mock.calls[0]?.[0])).toBe(true)
  })

  it('gives a frozen copy of an object value', () => {
    const { node: added, widgets } = node()
    const { value } = mount(widgets, { defaultValue: { list: [1] } })

    const read = value.get()

    expect(Object.isFrozen(read)).toBe(true)
    expect(read).not.toBe(added.widgets?.[0]?.value)
  })

  it.for([
    [0, 0],
    [false, false],
    [12.5, 12.5],
    [null, '']
  ] as const)(
    'holds, saves and sends %o as the host holds it',
    async ([given, held]) => {
      const { node: added, widgets } = node()

      const { handle, value } = mount(widgets, { defaultValue: given })

      expect(handle.isSerialized()).toBe(true)
      expect(value.get()).toBe(held)
      expect(handle.getValue()).toBe(held)
      expect(added.serialize().widgets_values).toEqual([held])
      const { output } = await graphToPrompt(graph)
      expect(Object.values(output)[0]?.inputs).toEqual({ panel: held })
    }
  )

  it('sets a number, a boolean or null, holding null as empty text', () => {
    const { widgets } = node()
    const { value } = mount(widgets, { defaultValue: 'text' })

    value.set(3)
    expect(value.get()).toBe(3)
    value.set(true)
    expect(value.get()).toBe(true)
    value.set(null)
    expect(value.get()).toBe('')
  })

  it('holds a number setValue commits, and tells onChange what the widget then holds', () => {
    const { widgets } = node()
    const { handle, value } = mount(widgets, { defaultValue: 'text' })
    const onChange = vi.fn()
    value.onChange(onChange)

    handle.setValue(5)
    handle.setValue(null)

    expect(onChange.mock.calls).toEqual([[5], ['']])
    expect(value.get()).toBe('')
    expect(handle.getValue()).toBe('')
  })

  it.for([[() => 1], [{ n: Number.NaN }], [undefined]])(
    'refuses a value a mounted widget cannot hold: %o',
    ([refused]) => {
      const { widgets } = node()
      const { value } = mount(widgets, { defaultValue: 'kept' })

      expectRefusal(() => Reflect.apply(value.set, value, [refused]), 'set')
      expect(value.get()).toBe('kept')
    }
  )

  it('refuses an onChange listener that is not a function', () => {
    const { widgets } = node()
    const { value } = mount(widgets)

    expect(() => Reflect.apply(value.onChange, value, ['f'])).toThrow(
      'onChange needs a function to call'
    )
  })

  it('fixes the height when one is given', () => {
    const { node: added, widgets } = node()

    mount(widgets, { height: 120 })

    expect(added.widgets?.[0]?.computeSize?.(200)).toEqual([200, 120])
  })

  it('calls destroy once when the widget is removed, after the host’s own cleanup', () => {
    const { node: added, widgets } = node()
    const destroy = vi.fn()
    mount(widgets, { destroy })
    const widget = added.widgets?.[0]
    assert(widget && isDOMWidget(widget))

    widgets.remove('panel')

    expect(destroy).toHaveBeenCalledOnce()
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(false)
  })

  it('removes a widget that has no destroy', () => {
    const { node: added, widgets } = node()
    mount(widgets)

    expect(widgets.remove('panel')).toBe(true)
    expect(added.widgets).toHaveLength(0)
  })

  it('calls destroy when the node is removed', () => {
    const { node: added, widgets } = node()
    const destroy = vi.fn()
    mount(widgets, { destroy })

    graph.remove(added)

    expect(destroy).toHaveBeenCalledOnce()
  })

  it('reports a render or destroy that throws, and keeps the host going', () => {
    const { node: added, widgets } = node()

    const handle = widgets.mount({
      name: 'panel',
      render: () => {
        throw new Error('render failed')
      },
      destroy: () => {
        throw new Error('destroy failed')
      }
    })
    widgets.remove('panel')

    expect(handle?.isDeleted).toBe(true)
    expect(added.widgets).toHaveLength(0)
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it.for([
    ['a name the node already has', { name: 'taken', render: () => {} }],
    ['no render', { name: 'panel' }],
    [
      'a destroy that is not a function',
      { name: 'p', render: () => {}, destroy: 1 }
    ],
    ['an unknown field', { name: 'p', render: () => {}, hidden: true }],
    ['a negative height', { name: 'p', render: () => {}, height: -1 }],
    [
      'a default it cannot save',
      { name: 'p', render: () => {}, defaultValue: { at: Number.NaN } }
    ],
    [
      'a flag that is not a boolean',
      { name: 'p', render: () => {}, serialize: 'yes' }
    ]
  ] as const)('refuses a definition with %s, and mounts nothing', ([, def]) => {
    const { node: added, widgets } = node()
    added.addWidget('number', 'taken', 1, () => {}, {})

    expectRefusal(() => Reflect.apply(widgets.mount, widgets, [def]), 'mount')
    expect(added.widgets).toHaveLength(1)
  })

  it.for(['serialize', 'hideOnZoom', 'sendToPrompt'])(
    'names %s when it is not a boolean',
    (field) => {
      const { widgets } = node()
      const def = { name: 'p', render: () => {}, [field]: 1 }

      expect(() => Reflect.apply(widgets.mount, widgets, [def])).toThrow(
        `mount needs ${field} as true or false, not 1.`
      )
    }
  )

  it('mounts nothing on a deleted node, and does not render', () => {
    const { node: added, widgets } = node()
    const render = vi.fn()
    graph.remove(added)

    expect(widgets.mount({ name: 'panel', render })).toBeUndefined()
    expect(render).not.toHaveBeenCalled()
  })
})
