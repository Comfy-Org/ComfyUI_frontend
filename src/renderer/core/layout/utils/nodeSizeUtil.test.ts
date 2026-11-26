import { describe, expect, it, onTestFinished } from 'vitest'

import { LiteGraph } from '@comfyorg/litegraph/litegraph'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'

describe('removeNodeTitleHeight', () => {
  it('subtracts the title height from a DOM-measured height', () => {
    expect(removeNodeTitleHeight(LiteGraph.NODE_TITLE_HEIGHT + 123)).toBe(123)
  })

  it('clamps heights shorter than the title to zero', () => {
    expect(removeNodeTitleHeight(LiteGraph.NODE_TITLE_HEIGHT - 5)).toBe(0)
  })

  it('leaves the height unchanged when the title height is undefined', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      LiteGraph,
      'NODE_TITLE_HEIGHT'
    )
    Object.defineProperty(LiteGraph, 'NODE_TITLE_HEIGHT', {
      configurable: true,
      value: undefined,
      writable: true
    })
    onTestFinished(() => {
      if (descriptor)
        Object.defineProperty(LiteGraph, 'NODE_TITLE_HEIGHT', descriptor)
    })

    expect(removeNodeTitleHeight(80)).toBe(80)
  })
})
