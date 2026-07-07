import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: () => {},
    getUserData: async () => ({ status: 404 }),
    storeUserData: async () => {}
  }
}))

vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({
    moveWorkflowThumbnail: () => {},
    clearThumbnail: () => {}
  })
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => ({
    getDraft: () => null,
    saveDraft: () => {},
    deleteDraft: () => {}
  })
}))

const SUBGRAPH_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('workflowStore node locator translation', () => {
  it('treats a node as a root-graph node when no subgraph is active', () => {
    const store = useWorkflowStore()
    expect(store.nodeIdToNodeLocatorId(toNodeId(5))).toBe('5')
  })

  it('prefixes the locator with an explicit subgraph uuid', () => {
    const store = useWorkflowStore()
    const subgraph = fromPartial<Subgraph>({ id: SUBGRAPH_UUID })

    expect(store.nodeIdToNodeLocatorId(toNodeId(5), subgraph)).toBe(
      `${SUBGRAPH_UUID}:5`
    )
  })

  it('derives a locator from a node based on whether its graph is a subgraph', () => {
    const store = useWorkflowStore()

    const rootNode = createMockLGraphNode({ id: toNodeId(7), graph: {} })
    expect(store.nodeToNodeLocatorId(rootNode)).toBe('7')
  })

  it('extracts the local node id from a locator', () => {
    const store = useWorkflowStore()
    expect(
      store.nodeLocatorIdToNodeId(
        createNodeLocatorId(SUBGRAPH_UUID, toNodeId(5))
      )
    ).toBe(toNodeId(5))
    expect(
      store.nodeLocatorIdToNodeId(createNodeLocatorId(null, toNodeId(9)))
    ).toBe(toNodeId(9))
  })

  it('round-trips a root node id through locator translation', () => {
    const store = useWorkflowStore()
    const locator = store.nodeIdToNodeLocatorId(toNodeId(42))
    expect(store.nodeLocatorIdToNodeId(locator)).toBe(toNodeId(42))
  })

  it('maps a root locator to a single-segment execution id', () => {
    const store = useWorkflowStore()
    expect(
      store.nodeLocatorIdToNodeExecutionId(
        createNodeLocatorId(null, toNodeId(5))
      )
    ).toBe('5')
  })
})
