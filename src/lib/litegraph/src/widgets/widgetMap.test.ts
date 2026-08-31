import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { LegacyWidget } from './LegacyWidget'
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

class SetterOnlyHeightWidget extends AccessorHeightWidget {
  override set height(_value: number) {
    this.heightWrites++
  }
}

describe('toConcreteWidget', () => {
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
})
