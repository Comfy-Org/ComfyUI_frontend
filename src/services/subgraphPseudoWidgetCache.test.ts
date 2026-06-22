import { describe, expect, it, vi } from 'vitest'

import { asNodeId } from '@/types/nodeId'

import { resolveSubgraphPseudoWidgetCache } from '@/services/subgraphPseudoWidgetCache'
import type {
  SubgraphPseudoWidget,
  SubgraphPseudoWidgetCache,
  SubgraphPseudoWidgetNode
} from '@/services/subgraphPseudoWidgetCache'

type PromotedPseudoWidgetSource = {
  sourceNodeId: ReturnType<typeof asNodeId>
  sourceWidgetName: string
}

interface TestWidget extends SubgraphPseudoWidget {
  isPseudo?: boolean
}

interface TestNode extends SubgraphPseudoWidgetNode<TestWidget> {
  widgets?: TestWidget[]
}

function widget(name: string, isPseudo = false): TestWidget {
  return { name, isPseudo }
}

function node(
  id: ReturnType<typeof asNodeId>,
  widgets: TestWidget[] = []
): TestNode {
  return { id, widgets }
}

describe('resolveSubgraphPseudoWidgetCache', () => {
  it('builds update targets from pseudo widget promotions', () => {
    const interiorNode = node(asNodeId(1), [widget('preview', true)])
    const getNodeById = vi.fn((id: ReturnType<typeof asNodeId>) =>
      id === asNodeId(1) ? interiorNode : undefined
    )
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([interiorNode])
    expect(result.cache.entries).toHaveLength(1)
    expect(getNodeById).toHaveBeenCalledWith(asNodeId(1))
  })

  it('keeps $$ fallback behavior when the backing widget is missing', () => {
    const interiorNode = node(asNodeId(1), [widget('other')])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: '$$canvas-image-preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === asNodeId(1) ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([interiorNode])
  })

  it('reuses cache when promotions and node identities are unchanged', () => {
    const interiorNode = node(asNodeId(1), [widget('preview', true)])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]
    const base = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === asNodeId(1) ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const getNodeById = vi.fn((id: ReturnType<typeof asNodeId>) =>
      id === asNodeId(1) ? interiorNode : undefined
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
    const interiorNode = node(asNodeId(1), [widget('preview', true)])
    const promotionsA: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]
    const base = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions: promotionsA,
      getNodeById: (id) => (id === asNodeId(1) ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const promotionsB: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: base.cache,
      promotions: promotionsB,
      getNodeById: (id) => (id === asNodeId(1) ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.cache).not.toBe(base.cache)
  })

  it('falls back to rebuild when a cached node reference goes stale', () => {
    const oldNode = node(asNodeId(1), [widget('preview', true)])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]
    const initial = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: () => oldNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })
    const newNode = node(asNodeId(1), [widget('preview', true)])

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
    const oldNode = node(asNodeId(1), [widget('preview', true)])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]
    const initial = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: () => oldNode,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(initial.nodes).toHaveLength(1)

    const replacementNode = node(asNodeId(1), [widget('other')])

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
    const nodeA = node(asNodeId(1), [widget('preview', true)])
    const nodeB = node(asNodeId(2), [widget('preview', true)])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' },
      { sourceNodeId: asNodeId(2), sourceWidgetName: 'preview' }
    ]
    const getNodeById = (id: ReturnType<typeof asNodeId>) => {
      if (id === asNodeId(1)) return nodeA
      if (id === asNodeId(2)) return nodeB
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

    const reducedPromotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'preview' }
    ]

    const reduced = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions: reducedPromotions,
      getNodeById,
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(reduced.nodes).toEqual([nodeA])
    expect(reduced.cache.entries).toHaveLength(1)
    expect(reduced.cache.entries[0].sourceNodeId).toBe(asNodeId(1))
  })

  it('excludes promotions where isPreviewPseudoWidget returns false', () => {
    const interiorNode = node(asNodeId(1), [widget('myWidget', false)])
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(1), sourceWidgetName: 'myWidget' }
    ]

    const result = resolveSubgraphPseudoWidgetCache<TestNode, TestWidget>({
      cache: null,
      promotions,
      getNodeById: (id) => (id === asNodeId(1) ? interiorNode : undefined),
      isPreviewPseudoWidget: (candidate) => candidate.isPseudo === true
    })

    expect(result.nodes).toEqual([])
    expect(result.cache.entries).toHaveLength(0)
  })

  it('drops cached entries when node no longer resolves', () => {
    const promotions: readonly PromotedPseudoWidgetSource[] = [
      { sourceNodeId: asNodeId(99), sourceWidgetName: '$$canvas-image-preview' }
    ]
    const cache: SubgraphPseudoWidgetCache<TestNode, TestWidget> = {
      promotions,
      entries: [
        {
          sourceNodeId: asNodeId(99),
          sourceWidgetName: '$$canvas-image-preview',
          node: node(asNodeId(99))
        }
      ],
      nodes: [node(asNodeId(99))]
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
