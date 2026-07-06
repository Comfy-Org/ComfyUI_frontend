import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'

import { startBadgeSystem } from './badgeSystem'

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

describe('badge system subgraph credits aggregation', () => {
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

    const graphId = rootGraph.id
    const knownNodes = new Map<unknown, LGraphNode>([[wrapper.id, wrapper]])
    function addInner(node: LGraphNode, id: number): LGraphNode {
      node.id = toNodeId(id)
      subgraph.add(node)
      knownNodes.set(node.id, node)
      return node
    }

    const stop = startBadgeSystem({
      graphId,
      resolveNode: (id) => knownNodes.get(id)
    })

    const wrapperCredits = () =>
      useNodeBadgeStore()
        .getBadges(graphId, wrapper.id)
        .filter((row) => row.kind === 'credits')
        .map((row) => row.text)

    return { subgraph, wrapper, addInner, stop, wrapperCredits }
  }

  it('shows no wrapper credits without priced inner nodes', async () => {
    const { addInner, stop, wrapperCredits } = setup()
    addInner(new LGraphNode('plain'), 11)
    await nextTick()

    expect(wrapperCredits()).toEqual([])
    stop()
  })

  it('passes a single inner api price through the wrapper', async () => {
    const { addInner, stop, wrapperCredits } = setup()
    addInner(new ApiNode('api'), 11)
    await nextTick()

    expect(wrapperCredits()).toEqual(['$0.05/Run'])
    stop()
  })

  it('counts partner nodes when several inner api nodes exist', async () => {
    const { addInner, stop, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    addInner(new ApiNode('api-2'), 12)
    await nextTick()

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
    stop()
  })

  it('counts api nodes whose price has not resolved yet', async () => {
    getNodeDisplayPrice.mockReturnValue('')
    const { addInner, stop, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    addInner(new ApiNode('api-2'), 12)
    await nextTick()

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
    stop()
  })

  it('reacts when an api node is added to the open subgraph', async () => {
    const { addInner, stop, wrapperCredits } = setup()
    addInner(new ApiNode('api-1'), 11)
    await nextTick()
    expect(wrapperCredits()).toEqual(['$0.05/Run'])

    addInner(new ApiNode('api-2'), 12)
    await nextTick()

    expect(wrapperCredits()).toEqual(['Partner Nodes x 2'])
    stop()
  })

  it('resolves promoted widget overrides for a single inner api node', async () => {
    const { subgraph, wrapper, addInner, stop, wrapperCredits } = setup()
    const apiNode = new ApiNode('api')
    const apiInput = apiNode.addInput('prompt', 'STRING')
    apiInput.widget = { name: 'prompt' }
    apiNode.addWidget('string', 'prompt', 'inner value', () => undefined, {})
    addInner(apiNode, 11)

    subgraph.inputNode.slots[0].connect(apiInput, apiNode)
    ;(wrapper as SubgraphNode)._internalConfigureAfterSlots()
    const inputWidgetId = wrapper.inputs[0].widgetId
    if (!inputWidgetId) throw new Error('Missing promoted input widgetId')
    useWidgetValueStore().setValue(inputWidgetId, 'outer value')
    await nextTick()

    expect(wrapperCredits()).toEqual(['outer value'])
    stop()
  })
})
