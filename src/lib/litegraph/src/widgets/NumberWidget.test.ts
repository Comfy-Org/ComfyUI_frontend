import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NumberWidget } from '@/lib/litegraph/src/widgets/NumberWidget'

describe('NumberWidget', () => {
  it('formats a non-numeric restored value without throwing', () => {
    const widget = new NumberWidget(
      {
        type: 'number',
        name: 'value',
        value: fromAny('1.5'),
        options: {},
        y: 0
      },
      new LGraphNode('TestNode')
    )
    expect(() => widget._displayValue).not.toThrow()
    expect(widget._displayValue).toBe('1.500')
  })
})
