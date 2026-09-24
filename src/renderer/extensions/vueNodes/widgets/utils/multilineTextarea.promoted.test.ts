import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import {
  createPromotedDomWidget,
  createPromotedMultilineWidget
} from './multilineTextarea'

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

function textareaSource(): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({
    name: 'prompt',
    type: 'customtext',
    element: document.createElement('textarea')
  })
}

function promote(
  source: IBaseWidget = textareaSource()
): IBaseWidget | undefined {
  return createPromotedMultilineWidget({
    subgraphNode: subgraphNode(),
    input: fromAny({ name: 'prompt', widgetId: WIDGET_ID }),
    widgetId: WIDGET_ID,
    sourceWidget: source
  })
}

function promoteMultilineDom(
  source: IBaseWidget = textareaSource()
): DOMWidget<HTMLTextAreaElement, string> {
  const widget = promote(source)
  if (!widget || !isDOMWidget<HTMLTextAreaElement, string>(widget)) {
    throw new Error('Expected a promoted multiline DOM widget')
  }
  return widget
}

describe('createPromotedMultilineWidget', () => {
  beforeEach(() => {
    useWidgetValueStore().registerWidget(WIDGET_ID, {
      type: 'customtext',
      value: 'hello',
      options: {}
    })
  })

  it('materializes a promoted textarea as a registered DOM widget', () => {
    const domWidget = promoteMultilineDom()

    expect(domWidget.element).toBeInstanceOf(HTMLTextAreaElement)
    expect(useDomWidgetStore().widgetStates.has(domWidget.id)).toBe(true)
  })

  it('reads its value from the host widget store entry', () => {
    const widget = promote()
    expect(widget?.value).toBe('hello')
  })

  it('writes textarea edits back to the host widget store entry', () => {
    const element = promoteMultilineDom().element

    element.value = 'edited'
    element.dispatchEvent(new Event('input'))

    expect(useWidgetValueStore().getWidget(WIDGET_ID)?.value).toBe('edited')
  })

  it('falls back to the canvas projection for non-DOM widgets', () => {
    const widget = promote(fromAny({ name: 'prompt', type: 'number' }))
    expect(widget).toBeUndefined()
  })

  it('defers materialization while the host node is not settled in its graph', () => {
    const unsettled = fromAny<LGraphNode, unknown>({
      id: 'node-1',
      graph: { rootGraph: { id: 'graph-1' }, getNodeById: () => undefined }
    })

    const widget = createPromotedMultilineWidget({
      subgraphNode: unsettled,
      input: fromAny({ name: 'prompt', widgetId: WIDGET_ID }),
      widgetId: WIDGET_ID,
      sourceWidget: textareaSource()
    })

    expect(widget).toBeUndefined()
    expect(useDomWidgetStore().widgetStates.size).toBe(0)
  })
})

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

  it('reuses the interior element for non-textarea DOM widgets', () => {
    const element = document.createElement('div')
    const source = fromAny<IBaseWidget, unknown>({
      name: 'preview',
      type: 'kj_preview',
      element,
      options: {}
    })

    const domWidget = promoteDom(source)

    expect(domWidget.element).toBe(element)
    expect(domWidget.type).toBe('kj_preview')
    expect(useDomWidgetStore().widgetStates.has(domWidget.id)).toBe(true)
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

  it('syncs direct edits on the reused element to the host widget store', () => {
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
