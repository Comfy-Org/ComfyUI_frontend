import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigrationFlush'
import { readHostQuarantine } from '@/core/graph/subgraph/migration/quarantineEntry'
import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

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

describe(flushProxyWidgetMigration, () => {
  it('returns an empty result when no proxyWidgets are present', () => {
    const host = buildHost()

    const result = flushProxyWidgetMigration({ hostNode: host })

    expect(result).toEqual({
      repaired: 0,
      primitiveRepaired: 0,
      previewMigrated: 0,
      quarantined: 0
    })
  })

  it('migrates a preview-shaped entry into the PreviewExposureStore', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('text', '$$canvas-image-preview', '', () => {})
    host.subgraph.add(innerNode)

    host.properties.proxyWidgets = [
      [String(innerNode.id), '$$canvas-image-preview']
    ]

    const result = flushProxyWidgetMigration({ hostNode: host })

    expect(result.previewMigrated).toBe(1)
    expect(result.quarantined).toBe(0)

    const exposures = usePreviewExposureStore().getExposures(
      host.rootGraph.id,
      String(host.id)
    )
    expect(exposures).toHaveLength(1)
    expect(exposures[0].sourcePreviewName).toBe('$$canvas-image-preview')
  })

  it('quarantines entries whose source node has disappeared', () => {
    const host = buildHost()
    host.properties.proxyWidgets = [['9999', 'seed']]

    const result = flushProxyWidgetMigration({ hostNode: host })

    expect(result.quarantined).toBe(1)
    expect(readHostQuarantine(host)).toEqual([
      expect.objectContaining({
        originalEntry: ['9999', 'seed'],
        reason: 'missingSourceNode'
      })
    ])
  })

  it('counts already-linked entries as repaired and applies the host value', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('number', 'seed', 0, () => {})
    host.subgraph.add(innerNode)

    const inputSlot = host.addInput('seed_link', '*')
    let widgetValue: TWidgetValue = 0
    inputSlot._widget = fromPartial<PromotedWidgetView>({
      node: host,
      name: 'seed',
      sourceNodeId: String(innerNode.id),
      sourceWidgetName: 'seed',
      get value() {
        return widgetValue
      },
      set value(v: TWidgetValue) {
        widgetValue = v
      }
    })

    host.properties.proxyWidgets = [[String(innerNode.id), 'seed']]
    const result = flushProxyWidgetMigration({
      hostNode: host,
      hostWidgetValues: [99]
    })

    expect(result.repaired).toBe(1)
    expect(result.quarantined).toBe(0)
    expect(widgetValue).toBe(99)
  })

  it('clears properties.proxyWidgets after a successful flush', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    innerNode.addWidget('text', '$$canvas-image-preview', '', () => {})
    host.subgraph.add(innerNode)

    host.properties.proxyWidgets = [
      [String(innerNode.id), '$$canvas-image-preview']
    ]

    flushProxyWidgetMigration({ hostNode: host })

    expect(host.properties.proxyWidgets).toBeUndefined()
  })

  describe('idempotency', () => {
    it('re-running flush over a fully migrated host produces no further mutations', () => {
      const host = buildHost()
      const innerNode = new LGraphNode('Inner')
      innerNode.addWidget('text', '$$canvas-image-preview', '', () => {})
      host.subgraph.add(innerNode)

      host.properties.proxyWidgets = [
        [String(innerNode.id), '$$canvas-image-preview']
      ]

      const first = flushProxyWidgetMigration({ hostNode: host })
      expect(first.previewMigrated).toBe(1)

      const exposuresAfterFirst = usePreviewExposureStore()
        .getExposures(host.rootGraph.id, String(host.id))
        .map((e) => ({ ...e }))

      const second = flushProxyWidgetMigration({ hostNode: host })

      expect(second).toEqual({
        repaired: 0,
        primitiveRepaired: 0,
        previewMigrated: 0,
        quarantined: 0
      })
      expect(
        usePreviewExposureStore().getExposures(
          host.rootGraph.id,
          String(host.id)
        )
      ).toEqual(exposuresAfterFirst)
    })

    it('re-running flush over a quarantined host does not duplicate quarantine entries', () => {
      const host = buildHost()
      host.properties.proxyWidgets = [['9999', 'seed']]
      flushProxyWidgetMigration({ hostNode: host })
      const firstQuarantine = readHostQuarantine(host)
      expect(firstQuarantine).toHaveLength(1)

      // Reseed proxyWidgets to simulate a stale legacy reload of the same
      // unresolved entry; flush must still produce no duplicates.
      host.properties.proxyWidgets = [['9999', 'seed']]
      flushProxyWidgetMigration({ hostNode: host })

      expect(readHostQuarantine(host)).toEqual(firstQuarantine)
    })
  })
})
