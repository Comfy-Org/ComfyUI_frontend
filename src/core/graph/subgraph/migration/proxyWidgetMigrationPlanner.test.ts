import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
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
import { planProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanner'
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

function findEntry(
  entries: readonly PendingMigrationEntry[],
  index: number
): PendingMigrationEntry {
  const entry = entries.find((e) => e.legacyOrderIndex === index)
  if (!entry) throw new Error(`Expected entry at legacyOrderIndex ${index}`)
  return entry
}

describe(planProxyWidgetMigration, () => {
  it('returns an empty plan when properties.proxyWidgets is missing', () => {
    const host = buildHost()

    const plan = planProxyWidgetMigration({ hostNode: host })

    expect(plan.entries).toEqual([])
  })

  it('tolerates a malformed proxyWidgets JSON string and returns empty', () => {
    const host = buildHost()
    host.properties.proxyWidgets = '{not json}'

    const plan = planProxyWidgetMigration({ hostNode: host })

    expect(plan.entries).toEqual([])
  })

  it('emits classified entries for a mixed value+preview cohort, preserving order', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('number', 'seed', 0, () => {})
    innerNode.addWidget('text', '$$canvas-image-preview', '', () => {})
    host.subgraph.add(innerNode)

    host.properties.proxyWidgets = [
      [String(innerNode.id), 'seed'],
      [String(innerNode.id), '$$canvas-image-preview']
    ]

    const plan = planProxyWidgetMigration({
      hostNode: host,
      hostWidgetValues: [99]
    })

    expect(plan.entries).toHaveLength(2)
    const valueEntry = findEntry(plan.entries, 0)
    expect(valueEntry.classification).toBe('value')
    expect(valueEntry.plan).toEqual({
      kind: 'createSubgraphInput',
      sourceWidgetName: 'seed'
    })
    expect(valueEntry.hostValue).toBe(99)

    const previewEntry = findEntry(plan.entries, 1)
    expect(previewEntry.classification).toBe('preview')
    expect(previewEntry.plan).toEqual({
      kind: 'previewExposure',
      sourcePreviewName: '$$canvas-image-preview'
    })
    expect(previewEntry.hostValue).toBe(HOST_VALUE_HOLE)
  })

  it('preserves sparse holes in widgets_values when they are missing', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('number', 'a', 0, () => {})
    innerNode.addWidget('number', 'b', 0, () => {})
    host.subgraph.add(innerNode)

    host.properties.proxyWidgets = [
      [String(innerNode.id), 'a'],
      [String(innerNode.id), 'b']
    ]

    const sparse: unknown[] = []
    sparse[1] = 'second-value'

    const plan = planProxyWidgetMigration({
      hostNode: host,
      hostWidgetValues: sparse
    })

    expect(findEntry(plan.entries, 0).hostValue).toBe(HOST_VALUE_HOLE)
    expect(findEntry(plan.entries, 1).hostValue).toBe('second-value')
  })

  it('emits a primitiveBypass plan per cohort entry pointing at the same primitive', () => {
    const host = buildHost()
    const primitive = new LGraphNode('Primitive')
    primitive.type = 'PrimitiveNode'
    primitive.addOutput('value', 'INT')
    host.subgraph.add(primitive)

    const targetA = new LGraphNode('TargetA')
    targetA.addInput('value', 'INT')
    targetA.addWidget('number', 'seed', 0, () => {})
    host.subgraph.add(targetA)

    const targetB = new LGraphNode('TargetB')
    targetB.addInput('value', 'INT')
    targetB.addWidget('number', 'seed', 0, () => {})
    host.subgraph.add(targetB)

    primitive.connect(0, targetA, 0)
    primitive.connect(0, targetB, 0)

    host.properties.proxyWidgets = [
      [String(primitive.id), 'value'],
      [String(primitive.id), 'value']
    ]

    const plan = planProxyWidgetMigration({ hostNode: host })

    expect(plan.entries).toHaveLength(2)
    for (const entry of plan.entries) {
      expect(entry.classification).toBe('primitiveFanout')
      expect(entry.plan.kind).toBe('primitiveBypass')
      if (entry.plan.kind !== 'primitiveBypass') continue
      expect(entry.plan.primitiveNodeId).toBe(primitive.id)
      expect(entry.plan.targets).toHaveLength(2)
    }
  })

  it('is idempotent: re-running on a host whose entries are already linked yields alreadyLinked plans', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('number', 'seed', 0, () => {})
    host.subgraph.add(innerNode)

    host.properties.proxyWidgets = [[String(innerNode.id), 'seed']]
    const firstPass = planProxyWidgetMigration({
      hostNode: host,
      hostWidgetValues: [42]
    })

    expect(findEntry(firstPass.entries, 0).plan).toEqual({
      kind: 'createSubgraphInput',
      sourceWidgetName: 'seed'
    })

    // Simulate the flush step linking the input.
    const inputSlot = host.addInput('seed', '*')
    inputSlot._widget = fromPartial<PromotedWidgetView>({
      node: host,
      name: 'seed',
      sourceNodeId: String(innerNode.id),
      sourceWidgetName: 'seed'
    })

    const secondPass = planProxyWidgetMigration({
      hostNode: host,
      hostWidgetValues: [42]
    })

    expect(secondPass.entries).toHaveLength(1)
    expect(findEntry(secondPass.entries, 0).plan).toEqual({
      kind: 'alreadyLinked',
      subgraphInputName: 'seed'
    })
  })

  it('quarantines entries pointing at missing source nodes', () => {
    const host = buildHost()
    host.properties.proxyWidgets = [['9999', 'seed']]

    const plan = planProxyWidgetMigration({ hostNode: host })

    expect(plan.entries).toHaveLength(1)
    expect(findEntry(plan.entries, 0).plan).toEqual({
      kind: 'quarantine',
      reason: 'missingSourceNode'
    })
  })
})
