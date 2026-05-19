import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

// Mirrors JSON.stringify(NaN) === "null" — the real source of null in workflows.
const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function serialisedNode(
  overrides: Partial<Omit<ISerialisedNode, 'widgets_values'>> & {
    widgets_values?: unknown[]
  } = {}
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
  } as ISerialisedNode
}

describe('LGraphNode.configure numeric widget sanitization', () => {
  let node: LGraphNode

  beforeEach(() => {
    node = new LGraphNode('TestNode')
  })

  it('preserves default when widgets_values contains null for a number widget', () => {
    node.addWidget('number', 'seed', 42, null, {})

    node.configure(serialisedNode({ widgets_values: roundTrip([NaN]) }))

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

  it('preserves default when widgets_values contains null for a gradientslider widget', () => {
    node.addWidget('gradientslider', 'denoise', 0.75, null, {})

    node.configure(serialisedNode({ widgets_values: roundTrip([NaN]) }))

    expect(node.widgets![0].value).toBe(0.75)
  })

  it('does not sanitize null for non-numeric widget types', () => {
    // TODO: null from a serialized workflow probably should not clobber text
    // widgets either; this test documents the current intentional scope limit.
    node.addWidget('text', 'prompt', 'default text', null, {})

    node.configure(serialisedNode({ widgets_values: [null] }))

    expect(node.widgets![0].value).toBeNull()
  })

  it('preserves correct slot ordering when a non-serialized widget precedes a sanitized numeric widget', () => {
    // widget A has serialize:false and must not consume a slot in widgets_values
    const widgetA = node.addWidget('text', 'label', 'hello', null, {})
    widgetA.serialize = false
    node.addWidget('number', 'seed', 42, null, {})

    // widgets_values has one entry — for the number widget only
    node.configure(serialisedNode({ widgets_values: roundTrip([NaN]) }))

    expect(node.widgets![0].value).toBe('hello') // non-serialized, untouched
    expect(node.widgets![1].value).toBe(42) // sanitized, default preserved
  })
})
