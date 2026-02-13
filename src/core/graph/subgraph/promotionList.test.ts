import { describe, expect, it } from 'vitest'

import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

import { getPromotionList } from './promotionList'

function mockSubgraphNode(proxyWidgets?: NodeProperty) {
  return {
    properties: { proxyWidgets }
  } satisfies Partial<
    Omit<SubgraphNode, 'constructor'>
  > as unknown as SubgraphNode
}

describe('getPromotionList', () => {
  it('returns empty array for node with no proxyWidgets property', () => {
    const node = mockSubgraphNode(undefined)
    expect(getPromotionList(node)).toEqual([])
  })

  it('returns empty array for empty proxyWidgets', () => {
    const node = mockSubgraphNode([])
    expect(getPromotionList(node)).toEqual([])
  })

  it('parses valid promotion entries', () => {
    const entries = [
      ['42', 'seed'],
      ['7', 'steps']
    ] satisfies ProxyWidgetsProperty
    const node = mockSubgraphNode(entries)
    expect(getPromotionList(node)).toEqual(entries)
  })

  it('handles string-serialized proxyWidgets (JSON)', () => {
    const entries = [['42', 'seed']] satisfies ProxyWidgetsProperty
    const node = mockSubgraphNode(JSON.stringify(entries))
    expect(getPromotionList(node)).toEqual(entries)
  })

  it('throws on invalid format', () => {
    const node = mockSubgraphNode('not-valid-json{{{')
    expect(() => getPromotionList(node)).toThrow()
  })

  it('throws on structurally invalid data', () => {
    const node = mockSubgraphNode([['only-one-element']])
    expect(() => getPromotionList(node)).toThrow()
  })
})
