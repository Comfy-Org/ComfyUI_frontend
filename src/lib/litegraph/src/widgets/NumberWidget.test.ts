import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'

function createWidget(): { node: LGraphNode; widget: NumberWidget } {
  const node = new LGraphNode('TestNode')
  const widget = new NumberWidget(
    {
      type: 'number',
      name: 'test',
      value: 1,
      options: { precision: 3 },
      y: 0
    },
    node
  )
  node.addCustomWidget(widget)
  return { node, widget }
}

function persistedNode(value: TWidgetValue): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    widgets_values: [value]
  }
}

describe('NumberWidget', () => {
  describe('_displayValue', () => {
    it.each<[TWidgetValue, string]>([
      ['both', 'NaN'],
      [true, '1.000'],
      ['', '0.000']
    ])(
      'coerces persisted non-number value %j before formatting without mutating it',
      (value, expected) => {
        const { node, widget } = createWidget()
        node.configure(persistedNode(value))

        expect(widget._displayValue).toBe(expected)
        expect(widget.value).toBe(value)
      }
    )

    it('preserves numeric formatting', () => {
      const { widget } = createWidget()

      expect(widget._displayValue).toBe('1.000')
      expect(widget.value).toBe(1)
    })
  })
})
