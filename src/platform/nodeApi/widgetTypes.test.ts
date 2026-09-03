/**
 * A pack-declared input type renders as a widget rather than degrading to a
 * socket, and holds a real value.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
// Installs LGraphNode.prototype.addDOMWidget as a side effect.
import '@/scripts/domWidget'
import { useWidgetStore } from '@/stores/widgetStore'

import { createGraphApi } from './graphHandle'
import {
  constructDeclaredWidget,
  createWidgetTypeRegistrar
} from './widgetTypes'

describe('pack-declared widget types', () => {
  let graph: LGraph
  let node: LGraphNode
  let defineWidgetType: ReturnType<typeof createWidgetTypeRegistrar>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('T', 'TestNode')
    graph.add(node)
    const graphApi = createGraphApi(() => graph)
    defineWidgetType = createWidgetTypeRegistrar((owner) =>
      graphApi.node(String(owner.id))!
    )
  })

  const build = (type: string, options: Record<string, unknown> = {}) =>
    constructDeclaredWidget(node, type, 'colour', options, options.default)

  it('makes the type render as a widget, not a socket', () => {
    // The host decides widget-vs-socket purely by this lookup, so an
    // unregistered type silently becomes an input socket.
    expect(
      useWidgetStore().inputIsWidget({ name: 'c', type: 'MTB_COLOR' })
    ).toBe(false)

    defineWidgetType('MTB_COLOR', { render: () => {} })

    expect(
      useWidgetStore().inputIsWidget({ name: 'c', type: 'MTB_COLOR' })
    ).toBe(true)
  })

  it('hands the renderer a container it can fill', () => {
    let filled: HTMLElement | undefined
    defineWidgetType('MTB_COLOR', {
      render: (container) => {
        filled = container
        container.append(document.createElement('input'))
      }
    })

    build('MTB_COLOR')

    expect(filled?.querySelector('input')).toBeTruthy()
  })

  it('holds a real value, so it is saved and sent', () => {
    defineWidgetType('MTB_COLOR', { render: () => {}, defaultValue: '#000000' })

    const built = build('MTB_COLOR')

    expect(built?.widget.serialize).not.toBe(false)
    expect(built?.widget.value).toBe('#000000')
  })

  it("prefers the definition's own default over the type's", () => {
    defineWidgetType('MTB_COLOR', { render: () => {}, defaultValue: '#000000' })

    const built = build('MTB_COLOR', { default: '#ff0000' })

    expect(built?.widget.value).toBe('#ff0000')
  })

  it('lets the renderer read and write the value', () => {
    let api: { get(): unknown; set(v: unknown): void } | undefined
    defineWidgetType('MTB_COLOR', {
      render: (_c, value) => {
        api = value
      }
    })

    const built = build('MTB_COLOR')
    api!.set('#123456')

    expect(built?.widget.value).toBe('#123456')
    expect(api!.get()).toBe('#123456')
  })

  it('supports numeric controls and exposes their declared options', () => {
    let options: Readonly<Record<string, unknown>> | undefined
    defineWidgetType('VHSINT', {
      defaultValue: 0,
      render: (_container, value, _name, context) => {
        options = context.getOptions()
        value.set(24)
      }
    })

    const built = build('VHSINT', {
      default: 12,
      step: 4,
      unit: 'frames'
    })

    expect(built?.widget.value).toBe(24)
    expect(options).toMatchObject({ default: 12, step: 4, unit: 'frames' })
    expect(Object.isFrozen(options)).toBe(true)
  })

  it('tells the renderer when the value changed elsewhere', () => {
    const seen = vi.fn()
    defineWidgetType('MTB_COLOR', {
      render: (_c, value) => {
        value.onChange(seen)
      }
    })

    const built = build('MTB_COLOR')
    // What a workflow load does: assign, then run the callback.
    built!.widget.value = '#abcdef'
    built!.widget.callback?.('#abcdef')

    expect(seen).toHaveBeenCalledWith('#abcdef')
  })

  it('tells the renderer which input it is drawing', () => {
    // A type-level renderer has no other way to know: rmbg's colour swatch
    // labels itself `name (value)`.
    let given: string | undefined
    defineWidgetType('MTB_COLOR', {
      render: (_c, _v, name) => {
        given = name
      }
    })

    build('MTB_COLOR')

    expect(given).toBe('colour')
  })

  it('hands the renderer its owning node after the node joins a graph', () => {
    graph.remove(node)
    const seen = vi.fn()
    defineWidgetType('MTB_COLOR', {
      render: (_container, _value, _name, context) => context.onNodeReady(seen)
    })

    build('MTB_COLOR')

    expect(seen).not.toHaveBeenCalled()
    graph.add(node)
    expect(seen).toHaveBeenCalledOnce()
    expect(seen.mock.calls[0][0].id).toBe(String(node.id))
  })

  it('tears down node-bound rendering when the owning node is removed', () => {
    const teardown = vi.fn()
    const ready = vi.fn(() => teardown)
    defineWidgetType('MTB_COLOR', {
      render: (_container, _value, _name, context) => context.onNodeReady(ready)
    })

    build('MTB_COLOR')
    graph.remove(node)

    expect(ready).toHaveBeenCalledOnce()
    expect(teardown).toHaveBeenCalledOnce()
  })

  it('passes the size hints through to the host', () => {
    defineWidgetType('MTB_COLOR', {
      render: () => {},
      minWidth: 150,
      minHeight: 22
    })

    const built = build('MTB_COLOR')

    expect(built?.minWidth).toBe(150)
    expect(built?.minHeight).toBe(22)
  })

  it('gives each widget its own copy of an object default', () => {
    // A default is declared once for the type. Handing out the same reference
    // meant a curve editor that edits its points in place moved every other
    // node's curve at the same time.
    defineWidgetType('MTB_CURVE', {
      render: () => {},
      defaultValue: { 0: { x: 0, y: 0 } }
    })

    const a = build('MTB_CURVE')
    const b = build('MTB_CURVE')
    ;(a!.widget.value as Record<string, { x: number }>)[0].x = 99

    expect((b!.widget.value as Record<string, { x: number }>)[0].x).toBe(0)
  })

  it('copies an object default declared on the node too', () => {
    defineWidgetType('MTB_CURVE', { render: () => {} })
    const declared = { 0: { x: 1, y: 1 } }

    const a = build('MTB_CURVE', { default: declared })
    ;(a!.widget.value as Record<string, { x: number }>)[0].x = 42

    expect(declared[0].x).toBe(1)
  })

  it('runs the renderer teardown when the widget goes', () => {
    const teardown = vi.fn()
    defineWidgetType('MTB_COLOR', { render: () => teardown })

    const built = build('MTB_COLOR')
    built!.widget.onRemove?.()

    expect(teardown).toHaveBeenCalled()
  })

  it('can be retired, so the type stops claiming the input', () => {
    const stop = defineWidgetType('MTB_COLOR', { render: () => {} })

    stop()

    expect(
      useWidgetStore().inputIsWidget({ name: 'c', type: 'MTB_COLOR' })
    ).toBe(false)
  })

  it('does not let an older registration retire its replacement', () => {
    const stopFirst = defineWidgetType('MTB_COLOR', { render: () => {} })
    const stopSecond = defineWidgetType('MTB_COLOR', { render: () => {} })

    stopFirst()
    expect(
      useWidgetStore().inputIsWidget({ name: 'c', type: 'MTB_COLOR' })
    ).toBe(true)

    stopSecond()
    expect(
      useWidgetStore().inputIsWidget({ name: 'c', type: 'MTB_COLOR' })
    ).toBe(false)
  })
})
