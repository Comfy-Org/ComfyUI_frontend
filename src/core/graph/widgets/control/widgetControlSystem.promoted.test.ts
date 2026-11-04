import { assert, describe, expect, it } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { runWidgetControl } from './widgetControlSystem'

class SeedNode extends LGraphNode {
  constructor(controlMode: string) {
    super('SeedNode')
    const input = this.addInput('seed', 'INT')
    input.widget = { name: 'seed' }

    const seed = this.addWidget('number', 'seed', 1, () => {}, {
      min: 0,
      max: 1_000_000,
      step2: 1
    })
    seed.controlConfig = {
      mode: controlMode === 'increment' ? 'increment' : 'fixed',
      hasFilter: false
    }
  }
}

function promotedSeedValue(host: SubgraphNode): unknown {
  const input = host.inputs.find((input) => input.name === 'seed')
  if (!input?.widgetId) throw new Error('seed was not promoted')
  return useWidgetValueStore().getWidget(input.widgetId)?.value
}

function createPromotedSeedHost(controlMode: string): SubgraphNode {
  const subgraph = createTestSubgraph()
  const seedNode = new SeedNode(controlMode)
  subgraph.add(seedNode)
  const host = createTestSubgraphNode(subgraph)
  const seedWidget = seedNode.widgets!.find((w) => w.name === 'seed')!
  const result = promoteValueWidgetViaSubgraphInput(host, seedNode, seedWidget)
  if (!result.ok) throw new Error(`promotion failed: ${result.reason}`)
  subgraph.rootGraph.add(host)
  return host
}

describe('runWidgetControl with promoted targets', () => {
  it('preserves an edited host control and execution history through rewiring', async () => {
    const host = createPromotedSeedHost('increment')
    const source = host.subgraph.nodes.find((node) => node.title === 'SeedNode')
    assert.exists(source)
    const input = host.inputs.find((input) => input.name === 'seed')
    assert.exists(input?.widgetId)
    const store = useWidgetValueStore()
    store.setValue(input.widgetId, 10)
    runWidgetControl(host.rootGraph, 'before', 'before')
    store.updateWidgetControl(input.widgetId, { mode: 'decrement' })

    host.subgraph.inputNode.slots[0].disconnect()
    host.subgraph.inputNode.slots[0].connect(source.inputs[0], source)
    await Promise.resolve()
    runWidgetControl(host.rootGraph, 'before', 'before')

    expect(promotedSeedValue(host)).toBe(9)
    expect(source.widgets?.[0].value).toBe(1)
  })

  it('advances only the authoritative outer value through nested promotion', () => {
    const outerGraph = createTestSubgraph()
    const innerGraph = createTestSubgraph({ rootGraph: outerGraph.rootGraph })
    const leaf = new SeedNode('increment')
    innerGraph.add(leaf)
    const inner = createTestSubgraphNode(innerGraph, {
      parentGraph: outerGraph
    })
    outerGraph.add(inner)
    const leafWidget = leaf.widgets?.[0]
    assert.exists(leafWidget)
    expect(promoteValueWidgetViaSubgraphInput(inner, leaf, leafWidget)).toEqual(
      {
        ok: true
      }
    )
    const innerWidget = inner.widgets[0]
    innerWidget.value = 17
    const outer = createTestSubgraphNode(outerGraph)
    outerGraph.rootGraph.add(outer)
    expect(
      promoteValueWidgetViaSubgraphInput(outer, inner, innerWidget)
    ).toEqual({
      ok: true
    })
    outer.widgets[0].value = 31

    runWidgetControl(outer.rootGraph, 'after', 'after')

    expect(promotedSeedValue(outer)).toBe(32)
    expect(promotedSeedValue(inner)).toBe(17)
    expect(leafWidget.value).toBe(1)
  })

  it('increments the host-owned value of a promoted seed after queueing', () => {
    const host = createPromotedSeedHost('increment')
    expect(promotedSeedValue(host)).toBe(1)

    runWidgetControl(host.rootGraph, 'after', 'after')

    expect(promotedSeedValue(host)).toBe(2)
  })

  it('leaves the value unchanged when the control mode is fixed', () => {
    const host = createPromotedSeedHost('fixed')

    runWidgetControl(host.rootGraph, 'after', 'after')

    expect(promotedSeedValue(host)).toBe(1)
  })

  it('does not run control on a host input fed by an external link', () => {
    const host = createPromotedSeedHost('increment')
    const seedInput = host.inputs.find((input) => input.name === 'seed')!
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    if (host.graph?.getNodeById(host.id) !== host) host.graph?.add(host)
    host.graph!.add(source)
    source.connect(0, host, host.inputs.indexOf(seedInput))
    expect(host.isInputConnected(host.inputs.indexOf(seedInput))).toBe(true)
    expect(seedInput.widgetId).toBeDefined()
    expect(
      useWidgetValueStore()
        .getWidgetControls(host.rootGraph.id)
        .map(([id]) => id)
    ).toContain(seedInput.widgetId)

    runWidgetControl(host.rootGraph, 'after', 'after')

    expect(promotedSeedValue(host)).toBe(1)
  })
})
