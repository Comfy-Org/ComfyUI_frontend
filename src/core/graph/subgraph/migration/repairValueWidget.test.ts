import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
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
import { repairValueWidget } from '@/core/graph/subgraph/migration/repairValueWidget'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'

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

function buildHost(): SubgraphNode {
  const subgraph = createTestSubgraph()
  const hostNode = createTestSubgraphNode(subgraph)
  const graph = hostNode.graph!
  graph.add(hostNode)
  return hostNode
}

function buildEntry(args: {
  sourceNodeId: string
  sourceWidgetName: string
  plan: PendingMigrationEntry['plan']
  hostValue?: PendingMigrationEntry['hostValue']
}): PendingMigrationEntry {
  return {
    normalized: {
      sourceNodeId: args.sourceNodeId,
      sourceWidgetName: args.sourceWidgetName
    },
    legacyOrderIndex: 0,
    hostValue: args.hostValue ?? HOST_VALUE_HOLE,
    classification: 'value',
    plan: args.plan
  }
}

describe(repairValueWidget, () => {
  describe('alreadyLinked plan', () => {
    it('applies host value to the linked input widget (host wins over interior)', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(innerNode)

      const inputSlot = host.addInput('seed_link', '*')
      inputSlot._widget = fromPartial<PromotedWidgetView>({
        node: host,
        name: 'seed',
        sourceNodeId: String(innerNode.id),
        sourceWidgetName: 'seed',
        value: 7
      })

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: String(innerNode.id),
          sourceWidgetName: 'seed',
          plan: { kind: 'alreadyLinked', subgraphInputName: 'seed_link' },
          hostValue: 99
        })
      })

      expect(result).toEqual({ ok: true, subgraphInputName: 'seed_link' })
      expect(inputSlot._widget?.value).toBe(99)
    })

    it('leaves widget value unchanged when hostValue is HOST_VALUE_HOLE', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(innerNode)

      const inputSlot = host.addInput('seed_link', '*')
      inputSlot._widget = fromPartial<PromotedWidgetView>({
        node: host,
        name: 'seed',
        sourceNodeId: String(innerNode.id),
        sourceWidgetName: 'seed',
        value: 7
      })

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: String(innerNode.id),
          sourceWidgetName: 'seed',
          plan: { kind: 'alreadyLinked', subgraphInputName: 'seed_link' }
        })
      })

      expect(result).toEqual({ ok: true, subgraphInputName: 'seed_link' })
      expect(inputSlot._widget?.value).toBe(7)
    })

    it('returns missingSubgraphInput when the linked SubgraphInput is gone', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(innerNode)

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: String(innerNode.id),
          sourceWidgetName: 'seed',
          plan: { kind: 'alreadyLinked', subgraphInputName: 'seed_link' }
        })
      })

      expect(result).toEqual({ ok: false, reason: 'missingSubgraphInput' })
    })
  })

  describe('createSubgraphInput plan', () => {
    it('creates exactly one new SubgraphInput linked to the source widget', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      const slot = innerNode.addInput('seed', 'INT')
      slot.widget = { name: 'seed' }
      innerNode.addWidget('number', 'seed', 0, () => {})
      host.subgraph.add(innerNode)

      const inputCountBefore = host.subgraph.inputs.length

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: String(innerNode.id),
          sourceWidgetName: 'seed',
          plan: { kind: 'createSubgraphInput', sourceWidgetName: 'seed' }
        })
      })

      expect(result.ok).toBe(true)
      expect(host.subgraph.inputs).toHaveLength(inputCountBefore + 1)
      const created = host.subgraph.inputs.at(-1)
      expect(created?._widget).toBeDefined()
      if (result.ok) {
        expect(result.subgraphInputName).toBe(created?.name)
      }
    })

    it('returns missingSourceNode when the source node is absent', () => {
      const host = buildHost()

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: '999',
          sourceWidgetName: 'seed',
          plan: { kind: 'createSubgraphInput', sourceWidgetName: 'seed' }
        })
      })

      expect(result).toEqual({ ok: false, reason: 'missingSourceNode' })
    })

    it('returns missingSourceWidget when the widget is absent on the source node', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      host.subgraph.add(innerNode)

      const result = repairValueWidget({
        hostNode: host,
        entry: buildEntry({
          sourceNodeId: String(innerNode.id),
          sourceWidgetName: 'nonexistent',
          plan: {
            kind: 'createSubgraphInput',
            sourceWidgetName: 'nonexistent'
          }
        })
      })

      expect(result).toEqual({ ok: false, reason: 'missingSourceWidget' })
    })
  })

  describe('invalid plan kind', () => {
    it('throws on unsupported plan kinds', () => {
      const host = buildHost()
      const entry = buildEntry({
        sourceNodeId: '7',
        sourceWidgetName: 'seed',
        plan: { kind: 'quarantine', reason: 'missingSourceNode' }
      })

      expect(() => repairValueWidget({ hostNode: host, entry })).toThrow(
        /invalid plan kind/
      )
    })
  })
})
