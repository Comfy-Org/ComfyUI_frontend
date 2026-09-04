import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import { LegacyWidget } from './LegacyWidget'
import { ButtonWidget } from './ButtonWidget'
import { TextWidget } from './TextWidget'
import { toConcreteWidget } from './widgetMap'

class AccessorHeightWidget implements IBaseWidget {
  [symbol: symbol]: boolean
  #height = 24
  name = 'custom'
  type = 'legacy_test'
  value = 0
  options = {}
  y = 0
  heightWrites = 0

  get height() {
    return this.#height
  }

  set height(value: number) {
    this.heightWrites++
    this.#height = value
  }
}

class NormalisingValueWidget implements IBaseWidget {
  [symbol: symbol]: boolean
  #value: { entries: number[] } = { entries: [] }
  name = 'custom'
  type = 'legacy_test'
  options = {}
  y = 0

  get value(): { entries: number[] } {
    return this.#value
  }

  set value(value: { entries: number[] } | number[]) {
    this.#value.entries = Array.isArray(value) ? value : value.entries
  }
}

class SetterOnlyHeightWidget extends AccessorHeightWidget {
  override set height(_value: number) {
    this.heightWrites++
  }
}

describe('toConcreteWidget', () => {
  it('supplies options when constructing a button without them', () => {
    const node = new LGraphNode('test')
    const widget = {
      name: 'run',
      type: 'button' as const,
      value: undefined,
      clicked: false,
      y: 0
    }

    const result = new ButtonWidget(widget, node)

    expect(result.options).toEqual({})
    result.options.hidden = true
    expect(result.hidden).toBe(true)
  })

  it('preserves the identity of a plain native widget', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'prompt',
      type: 'text',
      value: 'hello',
      options: {},
      y: 0
    }

    const result = toConcreteWidget(widget, node)

    expect(result).toBe(widget)
    expect(result).toBeInstanceOf(TextWidget)
  })

  it('keeps a wrapped legacy widget on the legacy dispatch path', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'custom',
      type: 'legacy_test',
      value: 0,
      options: {},
      y: 0
    }

    const result = toConcreteWidget(widget, node)

    expect(result).toBe(widget)
    expect(result).toBeInstanceOf(LegacyWidget)
    expect(toConcreteWidget(result, node, false)).toBeUndefined()
  })

  it('adopts an unknown legacy widget without options', () => {
    const node = new LGraphNode('test')
    const widget = fromPartial<IBaseWidget>({
      name: 'ghost',
      type: 'GHOST',
      value: 0,
      y: 0
    })

    const result = toConcreteWidget(widget, node)

    expect(result).toBe(widget)
    expect(result).toBeInstanceOf(LegacyWidget)
    expect(result.options).toEqual({})
    expect(result).toMatchObject({ name: 'ghost', type: 'GHOST', value: 0 })
  })

  it('returns a concrete replacement for a non-extensible widget', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = Object.preventExtensions({
      name: 'custom',
      type: 'legacy_test',
      value: 0,
      options: {},
      y: 0
    })

    const result = toConcreteWidget(widget, node)

    expect(result).not.toBe(widget)
    expect(result).toBeInstanceOf(LegacyWidget)
    expect(result.name).toBe('custom')
  })

  it('returns a concrete replacement when adoption would overwrite a fixed property', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'custom',
      type: 'legacy_test',
      value: 0,
      options: {},
      y: 0
    }
    Object.defineProperty(widget, 'name', { configurable: false })

    const result = toConcreteWidget(widget, node)

    expect(result).not.toBe(widget)
    expect(result).toBeInstanceOf(LegacyWidget)
    expect(result.name).toBe('custom')
  })

  it('preserves a foreign height accessor', () => {
    const node = new LGraphNode('test')
    const widget = new AccessorHeightWidget()

    const result = toConcreteWidget(widget, node)
    widget.height = 48

    expect(result).toBe(widget)
    expect(widget.heightWrites).toBe(1)
    expect(widget.height).toBe(48)
  })

  it('combines a foreign height setter with the concrete getter', () => {
    const node = new LGraphNode('test')
    const widget = new SetterOnlyHeightWidget()

    const result = toConcreteWidget(widget, node)
    widget.height = 48

    expect(widget.heightWrites).toBe(1)
    expect(result.height).not.toBeUndefined()
  })

  it('routes options.hidden writes and deletes through the adopted widget', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: {},
      y: 0
    }

    const result = toConcreteWidget(widget, node)

    expect(result).toBe(widget)
    result.options.hidden = true
    expect(result.hidden).toBe(true)
    delete result.options.hidden
    expect(result.hidden).toBe(false)
  })

  it('keeps visibility writes shimmed when adopted options are replaced', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: {},
      y: 0
    }

    const result = toConcreteWidget(widget, node)
    result.options = { ...result.options }
    result.options.hidden = true
    result.options.hideInPanel = true
    result.options.advanced = true

    expect(result.hidden).toBe(true)
    expect(result.visibility.surfaces.panel).toBe('never')
    expect(result.advanced).toBe(true)
  })

  it('preserves an adopted own hidden property as a live enumerable facade', () => {
    const node = new LGraphNode('test')
    const widget: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: {},
      y: 0,
      hidden: true
    }

    const result = toConcreteWidget(widget, node)

    expect(Object.keys(result)).toContain('hidden')
    expect(Object.fromEntries(Object.entries(result))).toMatchObject({
      hidden: true
    })
    expect(Object.getOwnPropertyDescriptor(result, 'hidden')).toEqual(
      expect.objectContaining({ enumerable: true, get: expect.any(Function) })
    )
    expect(JSON.stringify(result, ['hidden'])).toBe('{"hidden":true}')

    result.hidden = false
    expect(Object.fromEntries(Object.entries(result))).toMatchObject({
      hidden: false
    })
  })

  it('routes options.hidden writes to the store after registration', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.id = toNodeId(1)
    graph.add(node)
    const widget: IBaseWidget = {
      name: 'steps',
      type: 'number',
      value: 20,
      options: {},
      y: 0
    }

    const result = toConcreteWidget(widget, node)
    result.setNodeId(node.id)

    const store = useWidgetValueStore()
    const id = widgetId(graph.id, toNodeId(1), 'steps')

    result.options.hidden = true
    expect(result.hidden).toBe(true)
    expect(store.getWidgetVisibility(id)?.suppression.byExtension).toBe(true)

    delete result.options.hidden
    expect(result.hidden).toBe(false)
    expect(store.getWidgetVisibility(id)?.suppression.byExtension).toBe(false)
  })

  it('stores the value a foreign setter normalised', () => {
    const node = new LGraphNode('test')
    const widget = toConcreteWidget(new NormalisingValueWidget(), node)

    widget.value = [1, 2]

    expect(widget.value).toEqual({ entries: [1, 2] })
  })
})
