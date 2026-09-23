import { describe, expect, test } from 'vitest'
import { computed, isReactive } from 'vue'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

describe('slot label reactivity (regression #16642)', () => {
  test('plain-object output written by index is upgraded and reactive', () => {
    const node = new LGraphNode('Plain')
    node.addOutput('out', 'STRING')

    const outLabel = computed(() => node.outputs[0].label)
    expect(outLabel.value).toBeUndefined()

    const output: INodeOutputSlot = {
      name: 'out',
      type: 'STRING',
      links: [],
      boundingRect: new Float64Array(4)
    }
    node.outputs[0] = output
    expect(outLabel.value).toBeUndefined()

    node.outputs[0].label = 'c'

    expect(outLabel.value).toBe('c')
    expect(isReactive(node.outputs[0])).toBe(true)
  })
})
