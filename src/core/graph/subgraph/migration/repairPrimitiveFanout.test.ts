import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import type { PendingMigrationEntry } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { HOST_VALUE_HOLE } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { repairPrimitiveFanout } from '@/core/graph/subgraph/migration/repairPrimitiveFanout'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

interface PrimitiveScenario {
  host: SubgraphNode
  primitive: LGraphNode
  targets: LGraphNode[]
}

function buildPrimitiveScenario(targetCount: number): PrimitiveScenario {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph)
  host.graph!.add(host)

  const primitive = new LGraphNode('PrimitiveNode')
  primitive.type = 'PrimitiveNode'
  primitive.addOutput('value', 'INT')
  primitive.addWidget('number', 'value', 42, () => {})
  subgraph.add(primitive)

  const targets: LGraphNode[] = []
  for (let i = 0; i < targetCount; i++) {
    const target = new LGraphNode(`Target${i}`)
    const slot = target.addInput('value', 'INT')
    slot.widget = { name: 'value' }
    target.addWidget('number', 'value', 0, () => {})
    subgraph.add(target)
    primitive.connect(0, target, 0)
    targets.push(target)
  }

  return { host, primitive, targets }
}

function buildCohort(
  primitive: LGraphNode,
  targets: readonly LGraphNode[],
  options: { hostValuePerEntry?: readonly (number | undefined)[] } = {}
): PendingMigrationEntry[] {
  return targets.map((target, index) => ({
    normalized: {
      sourceNodeId: String(primitive.id),
      sourceWidgetName: 'value',
      // Distinguish entries by the downstream target so coalesce keeps each.
      disambiguatingSourceNodeId: String(target.id)
    },
    legacyOrderIndex: index,
    hostValue:
      options.hostValuePerEntry?.[index] !== undefined
        ? options.hostValuePerEntry[index]
        : HOST_VALUE_HOLE,
    classification: 'primitiveFanout',
    plan: {
      kind: 'primitiveBypass',
      primitiveNodeId: primitive.id,
      sourceWidgetName: 'value',
      targets: targets.map((t) => ({
        targetNodeId: t.id,
        targetSlot: 0
      }))
    }
  }))
}

describe(repairPrimitiveFanout, () => {
  it('repairs 1 primitive fanned out to 3 targets into a single SubgraphInput', () => {
    const { host, primitive, targets } = buildPrimitiveScenario(3)
    const cohort = buildCohort(primitive, targets)

    const subgraphInputCountBefore = host.subgraph.inputs.length
    const result = repairPrimitiveFanout({ hostNode: host, cohort })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reconnectCount).toBe(3)
    expect(host.subgraph.inputs).toHaveLength(subgraphInputCountBefore + 1)
    // After mutation each target's slot should no longer be linked to the primitive.
    for (const target of targets) {
      const slot = target.inputs[0]
      expect(slot.link).not.toBeNull()
      const link = host.subgraph.links.get(slot.link!)
      expect(link?.origin_id).not.toBe(primitive.id)
    }
  })

  it('host value (first by legacyOrderIndex) wins over primitive widget value', () => {
    const { host, primitive, targets } = buildPrimitiveScenario(2)
    const primitiveWidget = primitive.widgets!.find((w) => w.name === 'value')!
    primitiveWidget.value = 11

    const cohort = buildCohort(primitive, targets, {
      hostValuePerEntry: [123, 456]
    })

    const result = repairPrimitiveFanout({ hostNode: host, cohort })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const created = host.subgraph.inputs.find(
      (i) => i.name === result.subgraphInputName
    )
    expect(created?._widget?.value).toBe(123)
  })

  it('coalesces duplicate entries that share normalized source', () => {
    const { host, primitive, targets } = buildPrimitiveScenario(2)
    const cohort = buildCohort(primitive, targets)

    // Append an exact duplicate of the first cohort entry.
    cohort.push({ ...cohort[0], legacyOrderIndex: 99 })

    const result = repairPrimitiveFanout({ hostNode: host, cohort })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 2 unique targets → 2 reconnects regardless of duplicate cohort entries.
    expect(result.reconnectCount).toBe(2)
  })

  it('returns primitiveBypassFailed when a target slot type is incompatible', () => {
    const { host, primitive, targets } = buildPrimitiveScenario(1)
    // Replace the existing target slot type with something incompatible.
    targets[0].inputs[0].type = 'STRING'

    const cohort = buildCohort(primitive, targets)
    const subgraphInputCountBefore = host.subgraph.inputs.length

    const result = repairPrimitiveFanout({ hostNode: host, cohort })

    expect(result).toEqual({ ok: false, reason: 'primitiveBypassFailed' })
    // No new SubgraphInput created.
    expect(host.subgraph.inputs).toHaveLength(subgraphInputCountBefore)
  })

  it('returns primitiveBypassFailed for an empty cohort', () => {
    const { host } = buildPrimitiveScenario(0)
    const result = repairPrimitiveFanout({ hostNode: host, cohort: [] })

    expect(result).toEqual({ ok: false, reason: 'primitiveBypassFailed' })
  })
})
