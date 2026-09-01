import { describe, expect, it, vi } from 'vitest'

import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveSubgraphPseudoWidgetCache } from '@/services/subgraphPseudoWidgetCache'
import type {
  SubgraphPseudoWidget,
  SubgraphPseudoWidgetCache,
  SubgraphPseudoWidgetNode
} from '@/services/subgraphPseudoWidgetCache'

interface TestWidget extends SubgraphPseudoWidget {
  isPseudo?: boolean
}

interface TestNode extends SubgraphPseudoWidgetNode<TestWidget> {
  widgets?: TestWidget[]
}

function widget(name: string, isPseudo = false): TestWidget {
  return { name, isPseudo }
}

function node(id: string, widgets: TestWidget[] = []): TestNode {
  return { id, widgets }
}

describe('resolveSubgraphPseudoWidgetCache', () => {
  it('builds update targets from pseudo widget promotions', () => {
    const interiorNode = node('n1', [widget('preview', true)])
    const getNodeById = vi.fn((id: string) =>
      id === 'n1' ? interiorNode : undefined
    )
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([interiorNode])
    expect(result.cache.entries).toHaveLength(1)
    expect(getNodeById).toHaveBeenCalledWith('n1')
  })

  it('keeps $$ fallback behavior when the backing widget is missing', () => {
    const interiorNode = node('n1', [widget('other')])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: '$$canvas-image-preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === 'n1' ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([interiorNode])
  })

  it('reuses cache when promotions and node identities are unchanged', () => {
    const interiorNode = node('n1', [widget('preview', true)])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]
    const base = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === 'n1' ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const getNodeById = vi.fn((id: string) =>
      id === 'n1' ? interiorNode : undefined
    )

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: base.cache,
      promotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.cache).toBe(base.cache)
    expect(result.nodes).toBe(base.nodes)
    expect(getNodeById).toHaveBeenCalledTimes(1)
  })

  it('rebuilds cache when promotions reference changes', () => {
    const interiorNode = node('n1', [widget('preview', true)])
    const promotionsA: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]
    const base = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions: promotionsA,
      getNodeById: (id) => (id === 'n1' ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const promotionsB: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: base.cache,
      promotions: promotionsB,
      getNodeById: (id) => (id === 'n1' ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.cache).not.toBe(base.cache)
  })

  it('falls back to rebuild when a cached node reference goes stale', () => {
    const oldNode = node('n1', [widget('preview', true)])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]
    const initial = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: () => oldNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const newNode = node('n1', [widget('preview', true)])

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: initial.cache,
      promotions,
      getNodeById: () => newNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.cache).not.toBe(initial.cache)
    expect(result.nodes).toEqual([newNode])
  })

  it('rebuilds cache with different results when replacement node lacks the pseudo widget', () => {
    const oldNode = node('n1', [widget('preview', true)])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]
    const initial = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: () => oldNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(initial.nodes).toHaveLength(1)

    const replacementNode = node('n1', [widget('other')])

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: initial.cache,
      promotions,
      getNodeById: () => replacementNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.cache).not.toBe(initial.cache)
    expect(result.nodes).toEqual([])
    expect(result.cache.entries).toHaveLength(0)
  })

  it('includes all pseudo-widget promotions across multiple interior nodes', () => {
    const nodeA = node('n1', [widget('preview', true)])
    const nodeB = node('n2', [widget('preview', true)])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' },
      { sourceNodeId: 'n2', sourceWidgetName: 'preview' }
    ]
    const getNodeById = (id: string) => {
      if (id === 'n1') return nodeA
      if (id === 'n2') return nodeB
      return undefined
    }

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([nodeA, nodeB])
    expect(result.cache.entries).toHaveLength(2)

    const reducedPromotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'preview' }
    ]

    const reduced = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions: reducedPromotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(reduced.nodes).toEqual([nodeA])
    expect(reduced.cache.entries).toHaveLength(1)
    expect(reduced.cache.entries[0].sourceNodeId).toBe('n1')
  })

  it('excludes promotions where isPreviewPseudoWidget returns false', () => {
    const interiorNode = node('n1', [widget('myWidget', false)])
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'n1', sourceWidgetName: 'myWidget' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === 'n1' ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([])
    expect(result.cache.entries).toHaveLength(0)
  })

  it('drops cached entries when node no longer resolves', () => {
    const promotions: readonly PromotedWidgetSource[] = [
      { sourceNodeId: 'missing', sourceWidgetName: '$$canvas-image-preview' }
    ]
    const cache: SubgraphPseudoWidgetCache<TestNode, TestWidget> = {
      promotions,
      entries: [
        {
          sourceNodeId: 'missing',
          sourceWidgetName: '$$canvas-image-preview',
          node: node('missing')
        }
      ],
      nodes: [node('missing')]
    }

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache,
      promotions,
      getNodeById: () => undefined,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([])
    expect(result.cache.entries).toEqual([])
  })
})
