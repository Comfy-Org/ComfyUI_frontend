import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'
import type { UUID } from '@/utils/uuid'

import { computeBadges, startBadgeSystem } from './badgeSystem'
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
    pricing: { isApiNode: false, showApiPricing: false, priceLabel: '' },
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
      sources({
        pricing: { isApiNode: true, showApiPricing: true, priceLabel: '$0.04' }
      })
    )

    expect(rows.at(-1)).toEqual({
      kind: 'credits',
      text: '$0.04',
      iconKey: 'credits',
      fgColor: '#fff',
      bgColor: '#8D6932'
    })
  })

  it.for([
    {
      name: 'not an api node',
      pricing: { isApiNode: false, showApiPricing: true, priceLabel: '$1' }
    },
    {
      name: 'pricing hidden by setting',
      pricing: { isApiNode: true, showApiPricing: false, priceLabel: '$1' }
    },
    {
      name: 'no price label yet',
      pricing: { isApiNode: true, showApiPricing: true, priceLabel: '' }
    }
  ])('projects no credits row when $name', ({ pricing }) => {
    const rows = computeBadges(sources({ pricing }))

    expect(rows.filter((b) => b.kind === 'credits')).toEqual([])
  })

  function subgraphPricing(apiNodeCount: number, singleLabel = '') {
    return {
      isApiNode: false,
      showApiPricing: true,
      priceLabel: '',
      subgraphCredits: { apiNodeCount, singleLabel }
    }
  }

  it('aggregates multiple inner api nodes into a partner count', () => {
    const rows = computeBadges(sources({ pricing: subgraphPricing(5) }))

    expect(rows.at(-1)).toMatchObject({
      kind: 'credits',
      text: 'Partner Nodes x 5',
      iconKey: 'credits'
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

describe('startBadgeSystem', () => {
  const graphId: UUID = 'graph-root'

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

  it('writes rows for registered nodes and reacts to source changes', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(7)
    badgeStore.registerNode(graphId, node.id)

    const stop = startBadgeSystem({
      resolveGraphId: () => graphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })

    const texts = () =>
      badgeStore.getBadges(graphId, node.id).map((b) => b.text)
    expect(texts()).toEqual(['#7'])

    seedTestNodeDef()
    await nextTick()

    expect(texts()).toEqual(['[BETA]', '#7', 'my_pack'])

    stop()
  })

  it('starts watching nodes registered after system start', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(3)

    const stop = startBadgeSystem({
      resolveGraphId: () => graphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })
    expect(badgeStore.getBadges(graphId, node.id)).toEqual([])

    badgeStore.registerNode(graphId, node.id)
    await nextTick()

    expect(badgeStore.getBadges(graphId, node.id).map((b) => b.text)).toEqual([
      '#3'
    ])

    stop()
  })

  it('stops maintaining rows once a node is unregistered', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(7)
    badgeStore.registerNode(graphId, node.id)
    const stop = startBadgeSystem({
      resolveGraphId: () => graphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })

    badgeStore.unregisterNode(graphId, node.id)
    await nextTick()
    seedTestNodeDef()
    await nextTick()

    expect(badgeStore.registeredNodeIds(graphId)).toEqual([])
    expect(badgeStore.getBadges(graphId, node.id)).toEqual([])

    stop()
  })

  it('follows the root graph id across a workflow clear', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(9)
    let liveGraphId: UUID = graphId
    badgeStore.registerNode(graphId, node.id)

    const stop = startBadgeSystem({
      resolveGraphId: () => liveGraphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })
    expect(badgeStore.getBadges(graphId, node.id).map((b) => b.text)).toEqual([
      '#9'
    ])

    badgeStore.clearGraph(graphId)
    liveGraphId = 'graph-after-clear'
    badgeStore.registerNode(liveGraphId, node.id)
    await nextTick()

    expect(
      badgeStore.getBadges(liveGraphId, node.id).map((b) => b.text)
    ).toEqual(['#9'])

    stop()
  })

  it('follows a workflow load that replaces an unconfigured graph id', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(4)
    let liveGraphId: UUID = 'graph-unconfigured'
    const stop = startBadgeSystem({
      resolveGraphId: () => liveGraphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })

    liveGraphId = 'graph-configured'
    badgeStore.registerNode(liveGraphId, node.id)
    await nextTick()

    expect(
      badgeStore.getBadges(liveGraphId, node.id).map((b) => b.text)
    ).toEqual(['#4'])

    stop()
  })

  it('stops writing after the system itself is stopped', async () => {
    const badgeStore = useNodeBadgeStore()
    const node = makeNode(7)
    badgeStore.registerNode(graphId, node.id)
    const stop = startBadgeSystem({
      resolveGraphId: () => graphId,
      resolveNode: (id) => (id === node.id ? node : undefined)
    })

    stop()
    seedTestNodeDef()
    await nextTick()

    expect(badgeStore.getBadges(graphId, node.id).map((b) => b.text)).toEqual([
      '#7'
    ])
  })
})
