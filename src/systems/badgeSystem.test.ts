import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

import { computeBadges, nodeBadges } from './badgeSystem'
import type { BadgeSources } from './badgeSystem'

function sources(overrides: Partial<BadgeSources> = {}): BadgeSources {
  return {
    nodeId: toNodeId(5),
    nodeDef: {
      isCoreNode: false,
      lifecycleText: '[BETA]',
      sourceText: 'my-pack'
    },
    badgeModes: {
      id: NodeBadgeMode.ShowAll,
      lifecycle: NodeBadgeMode.ShowAll,
      source: NodeBadgeMode.ShowAll
    },
    colors: { fgColor: '#fff', bgColor: '#0b8', creditsBgColor: '#8D6932' },
    pricing: { kind: 'none' },
    ...overrides
  }
}

describe('computeBadges', () => {
  it('projects part-tagged core rows carrying raw source text', () => {
    expect(computeBadges(sources())).toEqual([
      {
        kind: 'core',
        part: 'lifecycle',
        text: '[BETA]',
        fgColor: '#fff',
        bgColor: '#0b8'
      },
      {
        kind: 'core',
        part: 'id',
        text: '#5',
        fgColor: '#fff',
        bgColor: '#0b8'
      },
      {
        kind: 'core',
        part: 'source',
        text: 'my-pack',
        fgColor: '#fff',
        bgColor: '#0b8'
      }
    ])
  })

  it('hides built-in nodes under HideBuiltIn, shows others', () => {
    const hideAll = {
      id: NodeBadgeMode.HideBuiltIn,
      lifecycle: NodeBadgeMode.HideBuiltIn,
      source: NodeBadgeMode.HideBuiltIn
    }
    const coreNode = sources({ badgeModes: hideAll })
    coreNode.nodeDef!.isCoreNode = true

    expect(computeBadges(coreNode)).toEqual([])
    expect(computeBadges(sources({ badgeModes: hideAll }))).toHaveLength(3)
  })

  it('hides each part independently under None', () => {
    const rows = computeBadges(
      sources({
        badgeModes: {
          id: NodeBadgeMode.None,
          lifecycle: NodeBadgeMode.ShowAll,
          source: NodeBadgeMode.None
        }
      })
    )

    expect(rows.map((b) => b.text)).toEqual(['[BETA]'])
  })

  it('projects only the id row without a node definition', () => {
    const rows = computeBadges(sources({ nodeDef: null }))

    expect(rows.map((b) => b.text)).toEqual(['#5'])
  })

  it('drops rows whose text is empty', () => {
    const empty = sources()
    empty.nodeDef!.lifecycleText = ''
    empty.nodeDef!.sourceText = ''

    expect(computeBadges(empty).map((b) => b.text)).toEqual(['#5'])
  })

  it('projects a credits row for a priced api node', () => {
    const rows = computeBadges(
      sources({ pricing: { kind: 'api-node', label: '$0.04' } })
    )

    expect(rows.at(-1)).toEqual({
      kind: 'credits',
      text: '$0.04',
      fgColor: '#fff',
      bgColor: '#8D6932'
    })
  })

  it.for([
    {
      name: 'pricing does not apply',
      pricing: { kind: 'none' } as const
    },
    {
      name: 'no price label yet',
      pricing: { kind: 'api-node', label: '' } as const
    }
  ])('projects no credits row when $name', ({ pricing }) => {
    const rows = computeBadges(sources({ pricing }))

    expect(rows.filter((b) => b.kind === 'credits')).toEqual([])
  })

  function subgraphPricing(apiNodeCount: number, singleLabel = '') {
    return { kind: 'subgraph', apiNodeCount, singleLabel } as const
  }

  it('aggregates multiple inner api nodes into a partner count', () => {
    const rows = computeBadges(sources({ pricing: subgraphPricing(5) }))

    expect(rows.at(-1)).toMatchObject({
      kind: 'credits',
      text: 'Partner Nodes x 5'
    })
  })

  it('passes a single inner api node label through to the wrapper', () => {
    const rows = computeBadges(
      sources({ pricing: subgraphPricing(1, '$0.05/Run') })
    )

    expect(rows.at(-1)).toMatchObject({ kind: 'credits', text: '$0.05/Run' })
  })

  it.for([
    { name: 'no inner api nodes', pricing: subgraphPricing(0) },
    { name: 'a single empty label', pricing: subgraphPricing(1, '') }
  ])('projects no wrapper credits row given $name', ({ pricing }) => {
    const rows = computeBadges(sources({ pricing }))

    expect(rows.filter((b) => b.kind === 'credits')).toEqual([])
  })
})

describe('nodeBadges', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function makeNode(id: number): LGraphNode {
    const node = new LGraphNode('Test')
    node.id = toNodeId(id)
    node.type = 'TestNode'
    return node
  }

  function seedTestNodeDef(): void {
    useNodeDefStore().addNodeDef({
      name: 'TestNode',
      display_name: 'Test Node',
      category: 'test',
      python_module: 'custom_nodes.my_pack',
      description: '',
      input: {},
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false,
      experimental: true
    })
  }

  it('derives rows and recomputes when a source changes', () => {
    const node = makeNode(7)

    expect(nodeBadges(node).map((b) => b.text)).toEqual(['#7'])

    seedTestNodeDef()

    expect(nodeBadges(node).map((b) => b.text)).toEqual([
      '[BETA]',
      '#7',
      'my_pack'
    ])
  })

  it('returns identity-stable rows until a source changes', () => {
    const node = makeNode(3)

    const first = nodeBadges(node)
    expect(nodeBadges(node)).toBe(first)

    seedTestNodeDef()
    const second = nodeBadges(node)
    expect(second).not.toBe(first)
    expect(nodeBadges(node)).toBe(second)
  })

  it('memoizes per node instance', () => {
    const a = makeNode(1)
    const b = makeNode(2)

    expect(nodeBadges(a).map((r) => r.text)).toEqual(['#1'])
    expect(nodeBadges(b).map((r) => r.text)).toEqual(['#2'])
    expect(nodeBadges(a)).toBe(nodeBadges(a))
  })
})
