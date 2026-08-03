import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'
import { applyPromotedWidgetControl } from './promotedWidgetControl'

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
    const control = this.addWidget(
      'combo',
      'control_after_generate',
      controlMode,
      () => {},
      { values: ['fixed', 'increment', 'decrement', 'randomize'] }
    )
    control[IS_CONTROL_WIDGET] = true
    control.beforeQueued = () => {}
    control.afterQueued = () => {}
    seed.linkedWidgets = [control]
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

describe('applyPromotedWidgetControl', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('increments the host-owned value of a promoted seed after queueing', () => {
    const host = createPromotedSeedHost('increment')
    expect(promotedSeedValue(host)).toBe(1)

    applyPromotedWidgetControl(host, 'afterQueued')

    expect(promotedSeedValue(host)).toBe(2)
  })

  it('leaves the value unchanged when the control mode is fixed', () => {
    const host = createPromotedSeedHost('fixed')

    applyPromotedWidgetControl(host, 'afterQueued')

    expect(promotedSeedValue(host)).toBe(1)
  })

  it('does not run control on a host input fed by an external link', () => {
    const host = createPromotedSeedHost('increment')
    const seedInput = host.inputs.find((input) => input.name === 'seed')!
    seedInput.link = toLinkId(99)

    applyPromotedWidgetControl(host, 'afterQueued')

    expect(promotedSeedValue(host)).toBe(1)
  })
})
