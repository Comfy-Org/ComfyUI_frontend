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

import { createWidgetTypeRegistrar } from './widgetTypes'

describe('pack-declared widget types', () => {
  let graph: LGraph
  let node: LGraphNode
  let defineWidgetType: ReturnType<typeof createWidgetTypeRegistrar>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('T', 'TestNode')
    graph.add(node)
    defineWidgetType = createWidgetTypeRegistrar()
  })

  const build = (type: string, spec: unknown = ['MTB_COLOR', {}]) =>
    useWidgetStore().widgets.get(type)?.(
      node,
      'colour',
      spec as never,
      undefined as never
    )

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

    const built = build('MTB_COLOR', ['MTB_COLOR', { default: '#ff0000' }])

    expect(built?.widget.value).toBe('#ff0000')
  })

  it('lets the renderer read and write the value', () => {
    let api: { get(): unknown; set(v: unknown): void } | undefined
    defineWidgetType('MTB_COLOR', {
      render: (_c, value) => {
        api = value as never
      }
    })

    const built = build('MTB_COLOR')
    api!.set('#123456')

    expect(built?.widget.value).toBe('#123456')
    expect(api!.get()).toBe('#123456')
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
    built!.widget.callback?.('#abcdef' as never)

    expect(seen).toHaveBeenCalledWith('#abcdef')
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
})
