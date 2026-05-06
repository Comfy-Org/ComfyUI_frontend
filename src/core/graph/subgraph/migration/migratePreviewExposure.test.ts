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
import { migratePreviewExposure } from '@/core/graph/subgraph/migration/migratePreviewExposure'
import type { ResolveNestedHostFn } from '@/stores/previewExposureStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

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
  hostNode.graph!.add(hostNode)
  return hostNode
}

function buildEntry(args: {
  sourceNodeId: string
  sourcePreviewName: string
}): PendingMigrationEntry {
  return {
    normalized: {
      sourceNodeId: args.sourceNodeId,
      sourceWidgetName: args.sourcePreviewName
    },
    legacyOrderIndex: 0,
    hostValue: HOST_VALUE_HOLE,
    classification: 'preview',
    plan: {
      kind: 'previewExposure',
      sourcePreviewName: args.sourcePreviewName
    }
  }
}

describe(migratePreviewExposure, () => {
  it('adds an exposure for a $$-prefixed preview source', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    host.subgraph.add(innerNode)

    const store = usePreviewExposureStore()
    const result = migratePreviewExposure({
      hostNode: host,
      entry: buildEntry({
        sourceNodeId: String(innerNode.id),
        sourcePreviewName: '$$canvas-image-preview'
      }),
      store
    })

    expect(result).toEqual({
      ok: true,
      previewName: '$$canvas-image-preview'
    })
    const locator = createNodeLocatorId(host.rootGraph.id, host.id)
    expect(store.getExposures(host.rootGraph.id, locator)).toHaveLength(1)
  })

  it('produces a unique name on collision via nextUniqueName', () => {
    const host = buildHost()
    const innerNode = new LGraphNode('Inner')
    host.subgraph.add(innerNode)
    const otherInner = new LGraphNode('OtherInner')
    host.subgraph.add(otherInner)

    const store = usePreviewExposureStore()
    const locator = createNodeLocatorId(host.rootGraph.id, host.id)
    store.addExposure(host.rootGraph.id, locator, {
      sourceNodeId: String(innerNode.id),
      sourcePreviewName: '$$canvas-image-preview'
    })

    const result = migratePreviewExposure({
      hostNode: host,
      entry: buildEntry({
        sourceNodeId: String(otherInner.id),
        sourcePreviewName: '$$canvas-image-preview'
      }),
      store
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.previewName).toBe('$$canvas-image-preview_1')
    expect(store.getExposures(host.rootGraph.id, locator)).toHaveLength(2)
  })

  it('returns missingSourceNode when the source node is absent', () => {
    const host = buildHost()
    const store = usePreviewExposureStore()

    const result = migratePreviewExposure({
      hostNode: host,
      entry: buildEntry({
        sourceNodeId: '999',
        sourcePreviewName: '$$canvas-image-preview'
      }),
      store
    })

    expect(result).toEqual({ ok: false, reason: 'missingSourceNode' })
  })

  it('round-trips through resolveChain across an outer host into an inner host', () => {
    // Set up an inner host with a leaf preview exposure, and a separate outer
    // host whose interior contains a placeholder for the inner host. The
    // chain walker is graph-agnostic, so we wire the nested-host edge via
    // the resolver callback.
    const innerSubgraph = createTestSubgraph({ name: 'Inner' })
    const innerHost = createTestSubgraphNode(innerSubgraph)
    innerHost.graph!.add(innerHost)
    const innerLeaf = new LGraphNode('Leaf')
    innerSubgraph.add(innerLeaf)

    const outerSubgraph = createTestSubgraph({ name: 'Outer' })
    const outerHost = createTestSubgraphNode(outerSubgraph)
    outerHost.graph!.add(outerHost)

    const placeholder = new LGraphNode('PlaceholderInnerHost')
    outerSubgraph.add(placeholder)

    const store = usePreviewExposureStore()
    const innerLocator = createNodeLocatorId(
      innerHost.rootGraph.id,
      innerHost.id
    )
    const outerLocator = createNodeLocatorId(
      outerHost.rootGraph.id,
      outerHost.id
    )

    // Inner host: the leaf exposure (canonical $$ name) the outer chain
    // ultimately resolves to.
    store.addExposure(innerHost.rootGraph.id, innerLocator, {
      sourceNodeId: String(innerLeaf.id),
      sourcePreviewName: '$$inner-preview'
    })

    // Outer host: migrate an entry whose source points at the placeholder
    // (representing the inner host inside outer's interior).
    const result = migratePreviewExposure({
      hostNode: outerHost,
      entry: {
        normalized: {
          sourceNodeId: String(placeholder.id),
          sourceWidgetName: '$$inner-preview'
        },
        legacyOrderIndex: 0,
        hostValue: HOST_VALUE_HOLE,
        classification: 'preview',
        plan: {
          kind: 'previewExposure',
          sourcePreviewName: '$$inner-preview'
        }
      },
      store
    })
    expect(result.ok).toBe(true)

    const resolveNestedHost: ResolveNestedHostFn = (
      _rootGraphId,
      _hostLocator,
      sourceNodeId
    ) =>
      sourceNodeId === String(placeholder.id)
        ? { rootGraphId: innerHost.rootGraph.id, hostNodeLocator: innerLocator }
        : undefined

    const chain = store.resolveChain(
      outerHost.rootGraph.id,
      outerLocator,
      '$$inner-preview',
      resolveNestedHost
    )

    expect(chain).toBeDefined()
    expect(chain?.steps).toHaveLength(2)
    expect(chain?.leaf.sourceNodeId).toBe(String(innerLeaf.id))
    expect(chain?.leaf.sourcePreviewName).toBe('$$inner-preview')
  })
})
