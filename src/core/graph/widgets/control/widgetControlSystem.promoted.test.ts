import { describe, expect, it } from 'vitest'

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
  return host
}

describe('runWidgetControl with promoted targets', () => {
  it('increments the host-owned value of a promoted seed after queueing', () => {
    const host = createPromotedSeedHost('increment')
    expect(promotedSeedValue(host)).toBe(1)

    runWidgetControl(host.rootGraph, 'after')

    expect(promotedSeedValue(host)).toBe(2)
  })

  it('leaves the value unchanged when the control mode is fixed', () => {
    const host = createPromotedSeedHost('fixed')

    runWidgetControl(host.rootGraph, 'after')

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

    runWidgetControl(host.rootGraph, 'after')

    expect(promotedSeedValue(host)).toBe(1)
  })
})
