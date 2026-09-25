import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

vi.mock(import('@/scripts/app'))

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComponentWidget, DOMWidget } from '@/scripts/domWidget'
import {
  DOMWidgetImpl,
  isComponentWidget,
  isDOMWidget
} from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import { widgetId as makeWidgetId } from '@/types/widgetId'

import { createPromotedDomWidget } from './promotedDomHost'

const WIDGET_ID = makeWidgetId('graph-1', toNodeId('node-1'), 'prompt')

function subgraphNode(): LGraphNode {
  const node = fromAny<LGraphNode, unknown>({
    id: 'node-1',
    graph: {
      rootGraph: { id: 'graph-1' },
      getNodeById: (id: unknown) =>
        id === toNodeId('node-1') ? node : undefined
    }
  })
  return node
}

describe('createPromotedDomWidget', () => {
  function promote(
    source: IBaseWidget,
    widgetId: WidgetId = WIDGET_ID,
    name: string = 'preview'
  ): IBaseWidget | undefined {
    return createPromotedDomWidget({
      subgraphNode: subgraphNode(),
      input: fromAny({ name, widgetId }),
      widgetId,
      sourceWidget: source
    })
  }

  function promoteDom(
    source: IBaseWidget,
    widgetId: WidgetId = WIDGET_ID,
    name: string = 'preview'
  ): DOMWidget<HTMLElement, string> {
    const widget = promote(source, widgetId, name)
    if (!widget || !isDOMWidget<HTMLElement, string>(widget)) {
      throw new Error('Expected a promoted DOM widget')
    }
    return widget
  }

  function promoteComponent(
    source: IBaseWidget
  ): ComponentWidget<string | object> {
    const widget = promote(source)
    if (!widget || !isComponentWidget<string | object>(widget)) {
      throw new Error('Expected a promoted component widget')
    }
    return widget
  }

  it('first host shares the interior element, later hosts get clones', () => {
    const element = document.createElement('div')
    element.textContent = 'interior content'
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'kj_preview',
      element,
      options: {},
      value: 'live'
    })

    const widgetA = promoteDom(
      source,
      makeWidgetId('g', toNodeId('n'), 'a'),
      'a'
    )
    const widgetB = promoteDom(
      source,
      makeWidgetId('g', toNodeId('n'), 'b'),
      'b'
    )

    expect(widgetA.element).toBe(element)
    expect(widgetB.element).not.toBe(element)
    expect(widgetB.element.textContent).toBe('interior content')
    expect(widgetA.type).toBe('kj_preview')
    expect(useDomWidgetStore().widgetStates.has(widgetA.id)).toBe(true)

    // Releasing the claim lets a fresh bind share the live element again.
    widgetA.onRemove?.()
    const widgetC = promoteDom(
      source,
      makeWidgetId('g', toNodeId('n'), 'c'),
      'c'
    )
    expect(widgetC.element).toBe(element)
    widgetC.onRemove?.()
    widgetB.onRemove?.()
  })

  it('mirrors in-place source DOM updates into clone hosts', async () => {
    const source = document.createElement('div')
    source.textContent = 'frame 1'
    const widget = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'kj_preview',
      element: source,
      options: {},
      value: 'frame 1'
    })
    const idA = makeWidgetId('g', toNodeId('n'), 'a')
    const idB = makeWidgetId('g', toNodeId('n'), 'b')

    const hostA = promoteDom(widget, idA, 'a')
    const hostB = promoteDom(widget, idB, 'b')
    expect(hostA.element).toBe(source)
    expect(hostB.element).not.toBe(source)

    // The streaming pattern: child swap plus attribute update, no value or
    // input event anywhere.
    const img = document.createElement('img')
    img.setAttribute('src', 'blob:frame2')
    source.replaceChildren(img)
    await Promise.resolve()

    expect(hostB.element.querySelector('img')?.getAttribute('src')).toBe(
      'blob:frame2'
    )

    img.setAttribute('src', 'blob:frame3')
    await Promise.resolve()
    expect(hostB.element.querySelector('img')?.getAttribute('src')).toBe(
      'blob:frame3'
    )

    // Root attributes follow the source in both directions, while
    // host-owned layout classes survive class merges.
    hostB.element.classList.add('h-full', 'w-full')
    source.setAttribute('hidden', '')
    await Promise.resolve()
    expect(hostB.element.hasAttribute('hidden')).toBe(true)

    source.removeAttribute('hidden')
    source.setAttribute('class', 'kj-pov-root active')
    await Promise.resolve()
    expect(hostB.element.hasAttribute('hidden')).toBe(false)
    expect(hostB.element.classList.contains('active')).toBe(true)
    expect(hostB.element.classList.contains('h-full')).toBe(true)

    source.setAttribute('class', 'kj-pov-root')
    await Promise.resolve()
    expect(hostB.element.classList.contains('active')).toBe(false)
    expect(hostB.element.classList.contains('h-full')).toBe(true)

    // Clone-host edits must not echo back into the shared source subtree.
    const hostBImg = hostB.element.querySelector('img')!
    hostBImg.setAttribute('data-host', 'touched')
    expect(source.querySelector('img')?.hasAttribute('data-host')).toBe(false)

    hostB.onRemove?.()
    img.setAttribute('src', 'blob:frame4')
    await Promise.resolve()
    expect(hostB.element.querySelector('img')?.getAttribute('src')).toBe(
      'blob:frame3'
    )
    hostA.onRemove?.()
  })

  it('keeps host clone elements synchronized with a value-bearing source', () => {
    const element = document.createElement('input')
    element.value = 'live'
    let interiorValue = 'live'
    const source = new DOMWidgetImpl<HTMLInputElement, string>({
      node: subgraphNode(),
      name: 'preview',
      type: 'text',
      element,
      options: {
        getValue: () => interiorValue,
        setValue: (value: string) => {
          interiorValue = value
          element.value = value
        }
      }
    })
    const idA = makeWidgetId('graph-1', toNodeId('node-1'), 'a')
    const idB = makeWidgetId('graph-1', toNodeId('node-1'), 'b')
    useWidgetValueStore().registerWidget(idA, {
      type: 'text',
      value: 'live',
      options: {}
    })
    useWidgetValueStore().registerWidget(idB, {
      type: 'text',
      value: 'live',
      options: {}
    })

    const hostA = promoteDom(source, idA, 'a')
    const hostB = promoteDom(source, idB, 'b')
    const elementA = hostA.element as HTMLInputElement
    const elementB = hostB.element as HTMLInputElement
    expect(elementA).toBe(element)
    expect(elementB).not.toBe(element)
    expect(elementA.value).toBe('live')
    expect(elementB.value).toBe('live')

    source.value = 'from interior'
    expect(elementA.value).toBe('from interior')
    expect(elementB.value).toBe('from interior')
    expect(useWidgetValueStore().getWidget(idA)?.value).toBe('from interior')

    elementB.value = 'from host b'
    elementB.dispatchEvent(new Event('input'))
    expect(source.value).toBe('from host b')
    expect(elementA.value).toBe('from host b')
    expect(useWidgetValueStore().getWidget(idB)?.value).toBe('from host b')
  })

  it('keeps promoted markdown clone hosts editable', () => {
    const root = document.createElement('div')
    root.classList.add('comfy-markdown')
    const preview = document.createElement('div')
    preview.classList.add('preview')
    preview.textContent = 'first'
    const textarea = document.createElement('textarea')
    textarea.value = 'first'
    root.append(preview, textarea)
    let interiorValue = 'first'
    const source = new DOMWidgetImpl<HTMLElement, string>({
      node: subgraphNode(),
      name: 'preview',
      type: 'MARKDOWN',
      element: root,
      options: {
        getValue: () => interiorValue,
        setValue: (value: string) => {
          interiorValue = value
          textarea.value = value
          preview.textContent = value
        }
      }
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'MARKDOWN',
      value: 'first',
      options: {}
    })
    const cloneId = makeWidgetId('g', toNodeId('n'), 'preview_b')
    useWidgetValueStore().registerWidget(cloneId, {
      type: 'MARKDOWN',
      value: 'first',
      options: {}
    })

    // The first host shares the live element; the interior widget's own
    // listeners own its behavior. Clone hosts replay them.
    const sharedHost = promoteDom(source)
    expect(sharedHost.element).toBe(root)

    const cloneHost = promoteDom(source, cloneId, 'preview_b')
    const clone = cloneHost.element
    expect(clone).not.toBe(root)

    const cloneTextarea = clone.querySelector('textarea')
    expect(cloneTextarea?.value).toBe('first')

    clone.dispatchEvent(new MouseEvent('dblclick'))
    expect(clone.classList.contains('editing')).toBe(true)

    cloneTextarea!.value = 'edited on host'
    cloneTextarea!.dispatchEvent(new Event('input', { bubbles: true }))
    expect(source.value).toBe('edited on host')
    expect(useWidgetValueStore().getWidget(cloneId)?.value).toBe(
      'edited on host'
    )
    expect(root.querySelector('.preview')?.textContent).toBe('edited on host')

    cloneTextarea!.dispatchEvent(new Event('blur'))
    expect(clone.classList.contains('editing')).toBe(false)
    expect(clone.querySelector('.preview')?.textContent).toBe('edited on host')

    source.value = 'from interior'
    expect(cloneTextarea?.value).toBe('from interior')
    expect(clone.querySelector('.preview')?.textContent).toBe('from interior')

    cloneHost.onRemove?.()
    sharedHost.onRemove?.()
  })

  it('reuses the interior component for component-backed widgets', () => {
    const component = { name: 'WidgetTextPreview' }
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'textPreview',
      component,
      inputSpec: { name: 'preview', type: 'TEXT_PREVIEW' },
      options: { getMinHeight: () => 60 }
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'textPreview',
      value: 'queued output',
      options: {}
    })

    const widget = promoteComponent(source)

    expect(widget.component).toBe(component)
    expect(widget.value).toBe('queued output')
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(true)
  })

  it('writes component widget edits back to the host widget store entry', () => {
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'textPreview',
      component: { name: 'WidgetTextPreview' },
      inputSpec: { name: 'preview', type: 'TEXT_PREVIEW' },
      options: {}
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'textPreview',
      value: 'queued output',
      options: {}
    })

    const widget = promoteComponent(source)
    widget.value = 'edited'

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('edited')
  })

  it('passes value reads and writes through to the interior widget', () => {
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'kj_preview',
      element: document.createElement('div'),
      options: {},
      value: 'live'
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'kj_preview',
      value: 'live',
      options: {}
    })

    const widget = promoteDom(source)

    expect(widget.value).toBe('live')
    widget.value = 'next'
    expect(source.value).toBe('next')
    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('next')
  })

  it('syncs direct edits on the interior element to the host widget store', () => {
    const element = document.createElement('div')
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'kj_preview',
      element,
      options: {},
      value: 'live'
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'kj_preview',
      value: 'live',
      options: {}
    })

    // The interior widget's element listener predates the promotion.
    element.addEventListener('input', () => {
      source.value = 'direct edit'
    })

    const widget = promoteDom(source)

    element.dispatchEvent(new Event('input'))

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe(
      'direct edit'
    )

    widget.onRemove?.()
    source.value = 'after removal'
    element.dispatchEvent(new Event('input'))

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe(
      'direct edit'
    )
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(false)
  })

  it('syncs setter-driven changes through the chained source callback', () => {
    const element = document.createElement('div')
    let interiorValue = 'live'
    const source = new DOMWidgetImpl<HTMLElement, string>({
      node: subgraphNode(),
      name: 'preview',
      type: 'kj_preview',
      element,
      options: {
        getValue: () => interiorValue,
        setValue: (value: string) => {
          interiorValue = value
        }
      }
    })
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'kj_preview',
      value: 'live',
      options: {}
    })

    const widget = promoteDom(source)

    source.value = 'randomized'

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('randomized')

    widget.onRemove?.()
    source.value = 'after removal'

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('randomized')
  })

  it('keeps each host sync independent when hosts share a source widget', () => {
    const element = document.createElement('div')
    let interiorValue = 'live'
    const source = new DOMWidgetImpl<HTMLElement, string>({
      node: subgraphNode(),
      name: 'preview',
      type: 'kj_preview',
      element,
      options: {
        getValue: () => interiorValue,
        setValue: (value: string) => {
          interiorValue = value
        }
      }
    })
    const originalCallback = vi.fn()
    source.callback = originalCallback
    const idA = makeWidgetId('graph-1', toNodeId('node-1'), 'a')
    const idB = makeWidgetId('graph-1', toNodeId('node-1'), 'b')
    useWidgetValueStore().registerWidget(idA, {
      type: 'kj_preview',
      value: 'live',
      options: {}
    })
    useWidgetValueStore().registerWidget(idB, {
      type: 'kj_preview',
      value: 'live',
      options: {}
    })

    const widgetA = promoteDom(source, idA, 'a')
    const widgetB = promoteDom(source, idB, 'b')

    source.value = 'both active'
    expect(useWidgetValueStore().getWidget(idA)?.value).toBe('both active')
    expect(useWidgetValueStore().getWidget(idB)?.value).toBe('both active')
    expect(originalCallback).toHaveBeenCalledTimes(1)

    widgetA.onRemove?.()
    source.value = 'after a removed'

    expect(useWidgetValueStore().getWidget(idA)?.value).toBe('both active')
    expect(useWidgetValueStore().getWidget(idB)?.value).toBe('after a removed')
    expect(originalCallback).toHaveBeenCalledTimes(2)

    widgetB.onRemove?.()

    expect(source.callback).toBe(originalCallback)
    source.value = 'after all removed'
    expect(useWidgetValueStore().getWidget(idB)?.value).toBe('after a removed')
    expect(originalCallback).toHaveBeenCalledTimes(3)
  })

  it('delegates textarea sources to the multiline host widget', () => {
    const element = document.createElement('textarea')
    const source = fromAny<IBaseWidget, unknown>({
      name: 'prompt',
      type: 'customtext',
      element
    })

    const widget = promoteDom(source)

    expect(widget.element).toBeInstanceOf(HTMLTextAreaElement)
    expect(widget.element).not.toBe(element)
    expect(useDomWidgetStore().widgetStates.has(widget.id)).toBe(true)
  })

  it('falls back to the canvas projection for non-DOM widgets', () => {
    expect(promote(fromAny({ name: 'value', type: 'number' }))).toBeUndefined()
  })
})
