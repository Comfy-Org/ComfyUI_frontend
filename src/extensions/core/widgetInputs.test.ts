import { beforeEach, describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

describe('PrimitiveNode serialize override', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('preserves widgets_values through clone-serialize when node has no widgets', () => {
    const node = new LGraphNode('test')
    node.serialize_widgets = true
    node.widgets_values = [42, 'fixed', '']

    const base = node.serialize()
    expect(base.widgets_values).toBeUndefined()

    node.serialize = function () {
      const o = LGraphNode.prototype.serialize.call(this)
      if (!o.widgets_values && this.widgets_values) {
        o.widgets_values = this.widgets_values
      }
      return o
    }

    const patched = node.serialize()
    expect(patched.widgets_values).toEqual([42, 'fixed', ''])
  })

  it('does not override widgets_values when base serialize produces them', () => {
    const node = new LGraphNode('test')
    node.serialize_widgets = true
    node.widgets_values = [99, 'decrement']
    node.addWidget('number', 'value', 42, () => {})

    node.serialize = function () {
      const o = LGraphNode.prototype.serialize.call(this)
      if (!o.widgets_values && this.widgets_values) {
        o.widgets_values = this.widgets_values
      }
      return o
    }

    const serialized = node.serialize()
    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values?.[0]).toBe(42)
  })
})
