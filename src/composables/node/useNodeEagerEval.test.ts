import { describe, expect, it } from 'vitest'

import {
  buildEagerEvalContext,
  useNodeEagerEval
} from '@/composables/node/useNodeEagerEval'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { EagerEval } from '@/schemas/nodeDefSchema'
import {
  createMockLGraphNode,
  createMockLLink
} from '@/utils/__tests__/litegraphTestUtils'

// ---------------------
// Test helpers
// ---------------------

function createMockEagerNode(
  config: Partial<EagerEval>,
  widgets: Array<{ name: string; value: unknown }> = [],
  inputs: Array<{ name: string; link: number | null }> = []
): LGraphNode {
  const fullConfig: EagerEval = { engine: 'jsonata', ...config }
  const mockWidgets = widgets.map(({ name, value }) => ({
    name,
    value,
    type: 'number'
  }))

  const baseNode = createMockLGraphNode()
  return Object.assign(baseNode, {
    widgets: mockWidgets,
    inputs,
    constructor: {
      nodeData: {
        name: 'TestMathNode',
        eager_eval: fullConfig
      }
    }
  })
}

// ---------------------
// buildEagerEvalContext
// ---------------------

describe('buildEagerEvalContext', () => {
  it('maps disconnected input widgets to context by name', () => {
    const node = createMockEagerNode(
      { expr: 'a + b' },
      [
        { name: 'a', value: 5 },
        { name: 'b', value: 3 }
      ],
      [
        { name: 'a', link: null },
        { name: 'b', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(5)
    expect(ctx.b).toBe(3)
  })

  it('skips connected inputs when linked node has no output data yet', () => {
    const node = createMockEagerNode(
      { expr: 'a + b' },
      [
        { name: 'a', value: 5 },
        { name: 'b', value: 3 }
      ],
      [
        { name: 'a', link: null },
        { name: 'b', link: 42 }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(5)
    expect('b' in ctx).toBe(false)
  })

  it('uses connected node output value when data is available', () => {
    const sourceNode = createMockLGraphNode()
    Object.assign(sourceNode, {
      outputs: [{ _data: 7, name: 'result' }]
    })

    const mockLink = createMockLLink({
      id: 42,
      origin_id: 99,
      origin_slot: 0,
      target_id: 1,
      target_slot: 1
    })

    const node = createMockEagerNode(
      { expr: 'a + b' },
      [{ name: 'a', value: 5 }],
      [
        { name: 'a', link: null },
        { name: 'b', link: 42 }
      ]
    )
    Object.assign(node, {
      graph: {
        getLink: (id: number) => (id === 42 ? mockLink : undefined),
        getNodeById: (id: number) => (id === 99 ? sourceNode : null)
      }
    })

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(5)
    expect(ctx.b).toBe(7)
  })

  it('assigns positional letters to connected inputs with data', () => {
    const sourceNode = createMockLGraphNode()
    Object.assign(sourceNode, {
      outputs: [{ _data: 12, name: 'value' }]
    })

    const mockLink = createMockLLink({
      id: 10,
      origin_id: 50,
      origin_slot: 0,
      target_id: 1,
      target_slot: 0
    })

    const node = createMockEagerNode(
      { expr: 'a * 2' },
      [],
      [{ name: 'x_input', link: 10 }]
    )
    Object.assign(node, {
      graph: {
        getLink: (id: number) => (id === 10 ? mockLink : undefined),
        getNodeById: (id: number) => (id === 50 ? sourceNode : null)
      }
    })

    const ctx = buildEagerEvalContext(node)
    expect(ctx.x_input).toBe(12)
    expect(ctx.a).toBe(12)
  })

  it('exposes autogrow base names (e.g. "value0") alongside full names ("values.value0")', () => {
    const node = createMockEagerNode(
      { expr_widget: 'expression' },
      [
        { name: 'expression', value: 'value0 + value1' },
        { name: 'values.value0', value: 3 },
        { name: 'values.value1', value: 7 }
      ],
      [
        { name: 'expression', link: null },
        { name: 'values.value0', link: null },
        { name: 'values.value1', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx['values.value0']).toBe(3)
    expect(ctx['values.value1']).toBe(7)
    expect(ctx['value0']).toBe(3)
    expect(ctx['value1']).toBe(7)
    expect(ctx.a).toBe(3)
    expect(ctx.b).toBe(7)
    expect((ctx as Record<string, unknown>).values).toEqual([3, 7])
  })

  it('includes values array for aggregate functions', () => {
    const node = createMockEagerNode(
      { expr: '$sum(values)' },
      [
        { name: 'value0', value: 1 },
        { name: 'value1', value: 2 },
        { name: 'value2', value: 3 }
      ],
      [
        { name: 'value0', link: null },
        { name: 'value1', link: null },
        { name: 'value2', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect((ctx as Record<string, unknown>).values).toEqual([1, 2, 3])
  })

  it('assigns positional letters (a, b, c) to disconnected inputs', () => {
    const node = createMockEagerNode(
      { expr: 'a * b' },
      [
        { name: 'x_input', value: 4 },
        { name: 'y_input', value: 7 }
      ],
      [
        { name: 'x_input', link: null },
        { name: 'y_input', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(4)
    expect(ctx.b).toBe(7)
    expect(ctx.x_input).toBe(4)
    expect(ctx.y_input).toBe(7)
  })

  it('parses string widget values as numbers', () => {
    const node = createMockEagerNode(
      { expr: 'a + b' },
      [
        { name: 'a', value: '10' },
        { name: 'b', value: '3.5' }
      ],
      [
        { name: 'a', link: null },
        { name: 'b', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(10)
    expect(ctx.b).toBe(3.5)
  })

  it('returns null for non-numeric widget values', () => {
    const node = createMockEagerNode(
      { expr: 'a' },
      [{ name: 'a', value: 'not a number' }],
      [{ name: 'a', link: null }]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBeNull()
  })

  it('includes standalone widgets not tied to inputs', () => {
    const node = createMockEagerNode(
      { expr: 'a', expr_widget: 'expression' },
      [
        { name: 'expression', value: 'a + 1' },
        { name: 'a', value: 5 }
      ],
      [{ name: 'a', link: null }]
    )

    const ctx = buildEagerEvalContext(node)
    expect(ctx.a).toBe(5)
  })

  it('excludes non-numeric values from the values array', () => {
    const node = createMockEagerNode(
      { expr: '$sum(values)' },
      [
        { name: 'v0', value: 1 },
        { name: 'v1', value: 'not a number' },
        { name: 'v2', value: 3 }
      ],
      [
        { name: 'v0', link: null },
        { name: 'v1', link: null },
        { name: 'v2', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect((ctx as Record<string, unknown>).values).toEqual([1, 3])
  })

  it('omits values array when all inputs are non-numeric', () => {
    const node = createMockEagerNode(
      { expr: 'a' },
      [{ name: 'a', value: 'hello' }],
      [{ name: 'a', link: null }]
    )

    const ctx = buildEagerEvalContext(node)
    expect('values' in ctx).toBe(false)
  })

  it('excludes expr_widget input from context and positional mapping', () => {
    const node = createMockEagerNode(
      { expr_widget: 'expression' },
      [
        { name: 'expression', value: 'a + b' },
        { name: 'a', value: 5 },
        { name: 'b', value: 2 },
        { name: 'c', value: 3 }
      ],
      [
        { name: 'expression', link: null },
        { name: 'a', link: null },
        { name: 'b', link: null },
        { name: 'c', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    expect('expression' in ctx).toBe(false)
    expect(ctx.a).toBe(5)
    expect(ctx.b).toBe(2)
    expect(ctx.c).toBe(3)
  })

  it('does not overwrite named inputs with positional letters', () => {
    const node = createMockEagerNode(
      { expr: 'a + b' },
      [
        { name: 'a', value: 10 },
        { name: 'b', value: 20 }
      ],
      [
        { name: 'a', link: null },
        { name: 'b', link: null }
      ]
    )

    const ctx = buildEagerEvalContext(node)
    // Named inputs 'a' and 'b' should keep their original values
    expect(ctx.a).toBe(10)
    expect(ctx.b).toBe(20)
  })
})

// ---------------------
// useNodeEagerEval
// ---------------------

describe('useNodeEagerEval', () => {
  describe('hasEagerEval', () => {
    it('returns true for nodes with eager_eval config', () => {
      const node = createMockEagerNode({ expr: 'a + b' })
      const { hasEagerEval } = useNodeEagerEval()
      expect(hasEagerEval(node)).toBe(true)
    })

    it('returns false for nodes without eager_eval', () => {
      const node = createMockLGraphNode()
      Object.assign(node, {
        constructor: { nodeData: { name: 'RegularNode' } }
      })
      const { hasEagerEval } = useNodeEagerEval()
      expect(hasEagerEval(node)).toBe(false)
    })

    it('returns false for nodes with no constructor data', () => {
      const node = createMockLGraphNode()
      const { hasEagerEval } = useNodeEagerEval()
      expect(hasEagerEval(node)).toBe(false)
    })
  })

  describe('formatEagerResult', () => {
    it('formats integer result', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: 42 })).toBe('42')
    })

    it('formats float result with trimmed zeros', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: 3.14 })).toBe('3.14')
    })

    it('trims trailing zeros', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: 3.1 })).toBe('3.1')
    })

    it('formats whole float as integer', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: 5.0 })).toBe('5')
    })

    it('returns error message for errors', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: null, error: 'bad expr' })).toBe(
        'bad expr'
      )
    })

    it('returns empty string for null value', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: null })).toBe('')
    })

    it('stringifies non-number values', () => {
      const { formatEagerResult } = useNodeEagerEval()
      expect(formatEagerResult({ value: true })).toBe('true')
    })
  })

  describe('getNodeEagerResult', () => {
    it('returns null for nodes without eager_eval', () => {
      const node = createMockLGraphNode()
      const { getNodeEagerResult } = useNodeEagerEval()
      expect(getNodeEagerResult(node)).toBeNull()
    })

    it('returns error for invalid expression', () => {
      const node = createMockEagerNode(
        { expr_widget: 'expression' },
        [{ name: 'expression', value: '(((' }],
        []
      )
      const { getNodeEagerResult } = useNodeEagerEval()
      const result = getNodeEagerResult(node)
      expect(result).toEqual({ value: null, error: 'Invalid expression' })
    })

    it('returns null when no expression configured', () => {
      const node = createMockEagerNode({}, [], [])
      const { getNodeEagerResult } = useNodeEagerEval()
      expect(getNodeEagerResult(node)).toBeNull()
    })

    it('returns null when expr_widget references missing widget', () => {
      const node = createMockEagerNode(
        { expr_widget: 'missing_widget' },
        [],
        []
      )
      const { getNodeEagerResult } = useNodeEagerEval()
      expect(getNodeEagerResult(node)).toBeNull()
    })

    it('returns null when expr_widget value is empty', () => {
      const node = createMockEagerNode(
        { expr_widget: 'expression' },
        [{ name: 'expression', value: '' }],
        []
      )
      const { getNodeEagerResult } = useNodeEagerEval()
      expect(getNodeEagerResult(node)).toBeNull()
    })

    it('returns cached result on subsequent calls with same inputs', async () => {
      const node = createMockEagerNode(
        { expr: 'a + b' },
        [
          { name: 'a', value: 2 },
          { name: 'b', value: 3 }
        ],
        [
          { name: 'a', link: null },
          { name: 'b', link: null }
        ]
      )
      const { getNodeEagerResult } = useNodeEagerEval()

      // First call schedules async eval
      const first = getNodeEagerResult(node)
      expect(first).toBeNull() // no cached result yet

      // Wait for async eval to complete
      await new Promise((r) => setTimeout(r, 50))

      // Second call returns cached result
      const second = getNodeEagerResult(node)
      expect(second).toEqual({ value: 5 })
    })
  })
})
