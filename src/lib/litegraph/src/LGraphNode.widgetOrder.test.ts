import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it } from 'vitest'

import { addDynamicCombo } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { sortWidgetValuesByInputOrder } from '@/workbench/utils/nodeDefOrderingUtil'

describe('LGraphNode widget ordering', () => {
  let node: LGraphNode

  beforeEach(() => {
    node = new LGraphNode('TestNode')
  })

  describe('configure with widgets_values', () => {
    beforeEach(() => {
      LiteGraph.namedValuesRestore = false
    })
    it('should apply widget values in correct order when widgets order matches input_order', () => {
      // Create node with widgets
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('text', 'prompt', '', null, {})

      // Configure with widget values
      const info: ISerialisedNode = {
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [30, 12345, 'test prompt']
      }

      node.configure(info)

      // Check widget values are applied correctly
      expect(node.widgets![0].value).toBe(30) // steps
      expect(node.widgets![1].value).toBe(12345) // seed
      expect(node.widgets![2].value).toBe('test prompt') // prompt
    })

    it('should handle mismatched widget order with input_order', () => {
      // Simulate widgets created in wrong order (e.g., from unordered Object.entries)
      // but widgets_values is in the correct order according to input_order
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('text', 'prompt', '', null, {})
      node.addWidget('number', 'steps', 20, null, {})

      // Widget values are in input_order: [steps, seed, prompt]
      const info: ISerialisedNode = {
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [30, 12345, 'test prompt']
      }

      // This would apply values incorrectly without proper ordering
      node.configure(info)

      // Without fix, values would be applied in wrong order:
      // seed (widget[0]) would get 30 (should be 12345)
      // prompt (widget[1]) would get 12345 (should be 'test prompt')
      // steps (widget[2]) would get 'test prompt' (should be 30)

      // This test demonstrates the bug - values are applied in wrong order
      expect(node.widgets![0].value).toBe(30) // seed gets steps value (WRONG)
      expect(node.widgets![1].value).toBe(12345) // prompt gets seed value (WRONG)
      expect(node.widgets![2].value).toBe('test prompt') // steps gets prompt value (WRONG)
    })

    it('should skip widgets with serialize: false', () => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('button', 'action', 'Click', null, {})
      node.widgets![1].serialize = false // button should not serialize
      node.addWidget('number', 'seed', 0, null, {})

      const info: ISerialisedNode = {
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [30, 12345] // Only serializable widgets
      }

      node.configure(info)

      expect(node.widgets![0].value).toBe(30) // steps
      expect(node.widgets![1].value).toBe('Click') // button unchanged
      expect(node.widgets![2].value).toBe(12345) // seed
    })

    it('round trips compact positional values around non-serializable widgets', () => {
      node.serialize_widgets = true
      node.addWidget('number', 'steps', 30, null, {})
      node.addWidget('button', 'action', 'Click', null, {}).serialize = false
      node.addWidget('number', 'seed', 12345, null, {})

      const serialized = node.serialize()
      const restored = new LGraphNode('Restored')
      restored.addWidget('number', 'steps', 0, null, {})
      restored.addWidget('button', 'action', 'Click', null, {}).serialize =
        false
      restored.addWidget('number', 'seed', 0, null, {})
      restored.configure(serialized)

      expect(serialized.widgets_values).toEqual([30, 12345])
      expect(restored.widgets!.map((widget) => widget.value)).toEqual([
        30,
        'Click',
        12345
      ])
    })

    it('restores positional values for widgets created after configure', () => {
      node.configure({
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [30, 12345]
      })

      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        30, 12345
      ])
    })
  })

  describe('configure with widgets_values_named', () => {
    function mockNode(
      values?: TWidgetValue[],
      named_values?: Record<string, TWidgetValue>
    ): ISerialisedNode {
      return {
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: values,
        widgets_values_named: named_values
      }
    }

    beforeEach(() => {
      LiteGraph.namedValuesRestore = true
    })

    it('should apply widget values from widgets_values_named', () => {
      // Create node with widgets
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('text', 'prompt', '', null, {})

      const named_values = { steps: 15, prompt: 'prompt', seed: 54321 }
      node.configure(mockNode([30, 12345, 'test prompt'], named_values))

      expect(node.widgets!.map((w) => w.value)).toStrictEqual([
        15,
        54321,
        'prompt'
      ])
    })

    it('should skip widgets with serialize: false', () => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('button', 'action', 'Click', null, {})
      node.widgets![1].serialize = false // button should not serialize
      node.addWidget('number', 'seed', 0, null, {})
      node.configure(mockNode([30, 12345], { steps: 30, seed: 12345 }))

      const expected = [30, 'Click', 12345]
      expect(node.widgets!.map((w) => w.value)).toStrictEqual(expected)
    })

    it('should restore widgets which are dynamically added', () => {
      addDynamicCombo(node, [['INT'], ['INT', 'STRING']])

      node.configure(
        mockNode(undefined, { '0': 1, '0.0.0.0': 5, '0.0.0.1': 'test' })
      )

      expect(node.widgets!.map((w) => w.value)).toStrictEqual([1, 5, 'test'])
    })

    it('restores delayed widgets by name and preserves the wire roundtrip', () => {
      node.configure(mockNode([30, 12345], { steps: 30, seed: 12345 }))

      node.addWidget('number', 'seed', 0, null, {})
      node.addWidget('number', 'steps', 0, null, {})
      node.serialize_widgets = true

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        12345, 30
      ])
      expect(node.serialize()).toMatchObject({
        widgets_values: [12345, 30],
        widgets_values_named: { seed: 12345, steps: 30 }
      })
    })

    it('should support restoration even when order has changed', () => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('number', 'seed', 5, null, {})
      node.serialize_widgets = true

      const node2 = new LGraphNode('TestNode2')
      node2.addWidget('number', 'seed', 0, null, {})
      node2.addWidget('number', 'steps', 0, null, {})

      node2.configure(node.serialize())

      expect(node2.widgets!.map((w) => w.value)).toStrictEqual([5, 20])
    })

    it('should support specifying order for legacy workflows', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      const nodeData = fromPartial({
        fallbackWidgetsValuesNames: ['seed', 'steps']
      })
      node.constructor = Object.assign({}, node.constructor, { nodeData })
      node.configure(mockNode([20, 5]))

      expect(node.widgets!.map((w) => w.value)).toStrictEqual([5, 20])
    })

    it('supports fallback names for non-iterable array-like values', () => {
      node.addWidget('number', 'steps', 0, null, {})
      node.addWidget('number', 'seed', 0, null, {})
      const nodeData = fromPartial({
        fallbackWidgetsValuesNames: ['seed', 'steps']
      })
      node.constructor = Object.assign({}, node.constructor, { nodeData })

      const info = mockNode()
      info.widgets_values = [20, 5]
      Object.defineProperties(info.widgets_values, {
        [Symbol.iterator]: { value: undefined },
        flatMap: { value: undefined }
      })
      node.configure(info)

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([5, 20])
    })

    it('does not restore dynamically added non-serializable widgets', () => {
      node.onConfigure = function () {
        this.addCustomWidget(
          fromPartial<IBaseWidget>({
            type: 'button',
            name: 'action',
            value: 'Click',
            serialize: false
          })
        )
        this.addWidget('number', 'seed', 0, null, {})
      }

      node.configure(mockNode([12345], { action: 'Restored', seed: 12345 }))

      expect(node.widgets!.map((widget) => widget.value)).toStrictEqual([
        'Click',
        12345
      ])
    })
  })
})

describe('sortWidgetValuesByInputOrder', () => {
  it('should reorder widget values based on input_order', () => {
    const inputOrder = ['steps', 'seed', 'prompt']
    const currentWidgetOrder = ['seed', 'prompt', 'steps']
    const widgetValues = [12345, 'test prompt', 30]

    const reordered = sortWidgetValuesByInputOrder(
      widgetValues,
      currentWidgetOrder,
      inputOrder
    )

    // Should reorder to match input_order: [steps, seed, prompt]
    expect(reordered).toEqual([30, 12345, 'test prompt'])
  })

  it('should handle widgets not in input_order', () => {
    const inputOrder = ['steps', 'seed']
    const currentWidgetOrder = ['seed', 'prompt', 'steps', 'cfg']
    const widgetValues = [12345, 'test prompt', 30, 7.5]

    const reordered = sortWidgetValuesByInputOrder(
      widgetValues,
      currentWidgetOrder,
      inputOrder
    )

    // Should put ordered items first, then unordered
    expect(reordered).toEqual([30, 12345, 'test prompt', 7.5])
  })

  it('should handle empty input_order', () => {
    const inputOrder: string[] = []
    const currentWidgetOrder = ['seed', 'prompt', 'steps']
    const widgetValues = [12345, 'test prompt', 30]

    const reordered = sortWidgetValuesByInputOrder(
      widgetValues,
      currentWidgetOrder,
      inputOrder
    )

    // Should return values unchanged
    expect(reordered).toEqual([12345, 'test prompt', 30])
  })

  it('should handle mismatched array lengths', () => {
    const inputOrder = ['steps', 'seed', 'prompt']
    const currentWidgetOrder = ['seed', 'prompt']
    const widgetValues = [12345, 'test prompt', 30] // Extra value

    const reordered = sortWidgetValuesByInputOrder(
      widgetValues,
      currentWidgetOrder,
      inputOrder
    )

    // Should handle gracefully, keeping extra values at the end
    // Since 'steps' is not in currentWidgetOrder, it won't be reordered
    // Only 'seed' and 'prompt' will be reordered based on input_order
    expect(reordered).toEqual([12345, 'test prompt', 30])
  })
})
