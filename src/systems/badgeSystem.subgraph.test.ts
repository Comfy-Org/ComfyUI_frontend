import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'

import { graphCreditsBadges, nodeBadges } from './badgeSystem'

function defaultDisplayPrice(
  _node: LGraphNode,
  overrides?: ReadonlyMap<string, unknown>
): string {
  return String(overrides?.get('prompt') ?? '$0.05/Run')
}
const getNodeDisplayPrice = vi.fn(defaultDisplayPrice)

vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({
    getNodeDisplayPrice,
    getNodeRevisionRef: () => ({ value: 0 }),
    hasDynamicPricing: () => false,
    getRelevantWidgetNames: () => [],
    getInputNames: () => [],
    getInputGroupPrefixes: () => []
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.NodeBadge.ShowApiPricing' ? true : undefined
  })
}))

class ApiNode extends LGraphNode {
  static override nodeData = { name: 'ApiNode', api_node: true }
}

describe('badge derivation subgraph credits aggregation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    getNodeDisplayPrice.mockReset()
    getNodeDisplayPrice.mockImplementation(defaultDisplayPrice)
  })

  function setup() {
    const rootGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'input', type: '*' }]
    })
    const wrapper = createTestSubgraphNode(subgraph, { id: 100 })
    rootGraph.add(wrapper)

    function addInner(node: LGraphNode, id: number): LGraphNode {
      node.id = toNodeId(id)
      subgraph.add(node)
      return node
    }

    const wrapperCredits = () =>
      nodeBadges(wrapper)
        .filter((row) => row.kind === 'credits')
        .map((row) => row.text)

    return { rootGraph, subgraph, wrapper, addInner, wrapperCredits }
  }

  it('shows no wrapper credits without priced inner nodes', () => {
    const { addInner, wrapperCredits } = setup()
    addInner(new LGraphNode('plain'), 11)

    expect(wrapperCredits()).toEqual([])
  })

  it('passes a single inner api price through the wrapper', () => {
    const { addInner, wrapperCredits } = setup()
    addInner(new ApiNode('api'), 11)

    expect(wrapperCredits()).toEqual(['$0.05/Run'])
  })

  it('counts partner nodes when several inner api nodes exist', () => {
    const { addInner, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    addInner(new ApiNode('api-2'), 12)

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
  })

  it('counts api nodes whose price has not resolved yet', () => {
    getNodeDisplayPrice.mockReturnValue('')
    const { addInner, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    addInner(new ApiNode('api-2'), 12)

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
  })

  it('reacts when an api node is added to the open subgraph', () => {
    const { addInner, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    expect(wrapperCredits()).toEqual(['$0.05/Run'])

    addInner(new ApiNode('api-2'), 12)

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
  })

  it('resolves promoted widget overrides for a single inner api node', () => {
    const { subgraph, wrapper, addInner, wrapperCredits } = setup()
    const apiNode = new ApiNode('api')
    const apiInput = apiNode.addInput('prompt', 'STRING')
    apiInput.widget = { name: 'prompt' }
    apiNode.addWidget('string', 'prompt', 'inner value', () => undefined, {})
    addInner(apiNode, 11)

    subgraph.inputNode.slots[0].connect(apiInput, apiNode)
    wrapper._internalConfigureAfterSlots()
    const inputWidgetId = wrapper.inputs[0].widgetId
    if (!inputWidgetId) throw new Error('Missing promoted input widgetId')
    useWidgetValueStore().setValue(inputWidgetId, 'outer value')

    expect(wrapperCredits()).toEqual(['outer value'])
  })

  describe('graphCreditsBadges', () => {
    it('lists priced nodes once and skips subgraph wrappers', () => {
      const { rootGraph, addInner } = setup()
      addInner(new ApiNode('inner-api'), 11)
      const rootNode = new ApiNode('root-api')
      rootNode.id = toNodeId(2)
      rootGraph.add(rootNode)

      expect(graphCreditsBadges(rootGraph)).toEqual([
        { nodeId: toNodeId(11), title: 'inner-api', price: '$0.05/Run' },
        { nodeId: toNodeId(2), title: 'root-api', price: '$0.05/Run' }
      ])
    })

    it('reacts when a priced node is added to the root graph', () => {
      const { rootGraph } = setup()
      expect(graphCreditsBadges(rootGraph)).toEqual([])

      const node = new ApiNode('root-api')
      node.id = toNodeId(2)
      rootGraph.add(node)

      expect(graphCreditsBadges(rootGraph)).toHaveLength(1)
    })
  })
})
