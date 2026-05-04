import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

function serialisedNode(
  overrides: Partial<ISerialisedNode> = {}
): ISerialisedNode {
  return {
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    ...overrides
  }
}

describe('LGraphNode.configure numeric widget sanitization', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    node = new LGraphNode('TestNode')
  })

  it('preserves default when widgets_values contains null for a number widget', () => {
    node.addWidget('number', 'seed', 42, null, {})

    // null can appear in widgets_values after JSON round-trip of NaN
    node.configure(
      serialisedNode({ widgets_values: [null] as unknown[] as number[] })
    )

    expect(node.widgets![0].value).toBe(42)
  })

  it('preserves default when widgets_values contains NaN for a number widget', () => {
    node.addWidget('number', 'seed', 42, null, {})

    node.configure(serialisedNode({ widgets_values: [NaN] }))

    expect(Number.isNaN(node.widgets![0].value)).toBe(false)
    expect(node.widgets![0].value).toBe(42)
  })

  it('still applies valid numeric values normally', () => {
    node.addWidget('number', 'seed', 42, null, {})

    node.configure(serialisedNode({ widgets_values: [99999] }))

    expect(node.widgets![0].value).toBe(99999)
  })

  it('does not sanitize null for non-numeric widget types', () => {
    node.addWidget('text', 'prompt', 'default text', null, {})

    node.configure(
      serialisedNode({ widgets_values: [null] as unknown[] as string[] })
    )

    expect(node.widgets![0].value).toBeNull()
  })
})
