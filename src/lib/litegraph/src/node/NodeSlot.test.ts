import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, toRaw, watch } from 'vue'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'
import {
  LGraphNode,
  inputAsSerialisable,
  outputAsSerialisable
} from '@/lib/litegraph/src/litegraph'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'

const boundingRect: ReadOnlyRect = [0, 0, 10, 10]

describe('NodeSlot', () => {
  describe('inputAsSerialisable', () => {
    it('removes _data from serialized slot', () => {
      const slot: INodeOutputSlot = {
        _data: 'test data',
        name: 'test-id',
        type: 'STRING',
        links: [],
        boundingRect
      }
      const node = new LGraphNode('test')
      const serialized = outputAsSerialisable(
        slot as INodeOutputSlot & { widget?: IWidget },
        node,
        0
      )
      expect(serialized).not.toHaveProperty('_data')
    })

    it('removes pos from widget input slots', () => {
      const node = new LGraphNode('test')
      // Minimal slot for serialization test - boundingRect is calculated at runtime, not serialized
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        pos: [10, 20],
        type: 'STRING',
        link: null,
        widget: { name: 'test-widget', type: 'combo' },
        boundingRect
      }

      const serialized = inputAsSerialisable(widgetInputSlot, node, 0)
      expect(serialized).not.toHaveProperty('pos')
    })

    it('preserves pos for non-widget input slots', () => {
      const node = new LGraphNode('test')
      const normalSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        pos: [10, 20],
        link: null,
        boundingRect
      }
      const serialized = inputAsSerialisable(normalSlot, node, 0)
      expect(serialized).toHaveProperty('pos')
    })

    it('preserves only widget name during serialization', () => {
      const node = new LGraphNode('test')
      // Extra widget properties simulate real data that should be stripped during serialization
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        link: null,
        boundingRect,
        widget: {
          name: 'test-widget',
          type: 'combo'
        }
      }

      const serialized = inputAsSerialisable(widgetInputSlot, node, 0)
      expect(serialized.widget).toEqual({ name: 'test-widget' })
      expect(serialized.widget).not.toHaveProperty('type')
      expect(serialized.widget).not.toHaveProperty('value')
      expect(serialized.widget).not.toHaveProperty('options')
    })
  })

  describe('reactivity', () => {
    it('notifies readers when an input slot label is renamed', async () => {
      const node = new LGraphNode('test')
      node.addInput('original_name', 'STRING')

      const labels = computed(() => node.inputs.map((input) => input.label))
      const onChange = vi.fn()
      watch(labels, onChange)
      expect(labels.value).toEqual([undefined])

      node.inputs[0].label = 'custom_label'
      await nextTick()

      expect(labels.value).toEqual(['custom_label'])
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('notifies readers when an output slot label is renamed', async () => {
      const node = new LGraphNode('test')
      node.addOutput('original_name', 'STRING')

      const labels = computed(() => node.outputs.map((output) => output.label))
      const onChange = vi.fn()
      watch(labels, onChange)
      expect(labels.value).toEqual([undefined])

      node.outputs[0].label = 'custom_label'
      await nextTick()

      expect(labels.value).toEqual(['custom_label'])
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('notifies readers when slots are added and removed', async () => {
      const node = new LGraphNode('test')
      const names = computed(() => node.inputs.map((input) => input.name))
      const onChange = vi.fn()
      watch(names, onChange)

      node.addInput('first', 'STRING')
      await nextTick()
      expect(names.value).toEqual(['first'])

      node.removeInput(0)
      await nextTick()
      expect(names.value).toEqual([])
      expect(onChange).toHaveBeenCalledTimes(2)
    })

    it('returns the tracked slot from addInput, the array, and the node', () => {
      const node = new LGraphNode('test')
      const added = node.addInput('slot', 'STRING')

      expect(node.inputs[0]).toBe(added)
      expect(node.inputs.indexOf(added)).toBe(0)
      expect(added).toBeInstanceOf(NodeInputSlot)
    })

    it('uses native indexOf fromIndex semantics', () => {
      const node = new LGraphNode('test')
      const first = node.addInput('first', 'STRING')
      node.addInput('second', 'STRING')
      const last = node.addInput('last', 'STRING')

      expect(node.inputs.indexOf(first, -2)).toBe(-1)
      expect(node.inputs.indexOf(first, Number.NaN)).toBe(0)
      expect(node.inputs.indexOf(last, 1.5)).toBe(2)
    })

    it('handles negative infinity as an indexOf fromIndex', () => {
      const node = new LGraphNode('test')
      const input = node.addInput('slot', 'STRING')

      expect(node.inputs.indexOf(input, -Infinity)).toBe(0)
    })

    it('leaves nested slot values raw so identity comparisons hold', () => {
      const node = new LGraphNode('test')
      const widget = node.addWidget('number', 'num', 1, () => undefined, {})
      const input = node.addInput('num', 'INT')
      input._widget = widget

      expect(input._widget).toBe(widget)
      expect(input.boundingRect).toBe(toRaw(input).boundingRect)
    })
  })
})
