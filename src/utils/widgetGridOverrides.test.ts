import { describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  clearAllGridOverrides,
  clearGridOverride,
  readGridOverrides,
  setGridOverride
} from '@/utils/widgetGridOverrides'

function nodeWith(properties: Record<string, unknown> = {}): LGraphNode {
  return { properties } as unknown as LGraphNode
}

describe('widgetGridOverrides', () => {
  it('round-trips an override through node properties', () => {
    const node = nodeWith()
    setGridOverride(node, 'prompt', '200px')

    expect(readGridOverrides(node)).toEqual({ prompt: '200px' })
  })

  it('keeps overrides for other widgets when one is cleared', () => {
    const node = nodeWith()
    setGridOverride(node, 'positive', '200px')
    setGridOverride(node, 'negative', '80px')

    clearGridOverride(node, 'positive')

    expect(readGridOverrides(node)).toEqual({ negative: '80px' })
  })

  it('removes the property key once the last override is cleared', () => {
    const node = nodeWith()
    setGridOverride(node, 'prompt', '200px')
    clearAllGridOverrides(node)

    expect(node.properties).not.toHaveProperty('gridOverrides')
    expect(readGridOverrides(node)).toBeUndefined()
  })

  it('ignores non-string persisted values', () => {
    const node = nodeWith({ gridOverrides: { prompt: 200, seed: '80px' } })

    expect(readGridOverrides(node)).toEqual({ seed: '80px' })
  })

  it('treats a malformed gridOverrides value as absent', () => {
    expect(
      readGridOverrides(nodeWith({ gridOverrides: 'nope' }))
    ).toBeUndefined()
  })
})
