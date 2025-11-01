import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '../litegraph/subgraph/fixtures/subgraphHelpers'

// Mock telemetry to break circular dependency (telemetry → workflowStore → app → telemetry)
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

// Add mock for api at the top of the file
vi.mock('@/scripts/api', () => ({
  api: {
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    listUserDataFullInfo: vi.fn(),
    apiURL: vi.fn(),
    addEventListener: vi.fn()
  }
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    prompt: () => 'testname',
    confirm: () => true
  }))
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => ({
    getCanvas: () => comfyApp.canvas
  }))
}))

// Mock comfyApp globally for the store setup
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      _deserializeItems: vi.fn((i) => i),
      ds: { visible_area: [0, 0, 0, 0] },
      selected_nodes: null
    },
    loadGraphData: vi.fn()
  }
}))

const mockGraph = {
  nodes: [{ type: '123' }],
  definitions: { subgraphs: [{ id: '123' }] }
}

describe('useSubgraphStore', () => {
  let store: ReturnType<typeof useSubgraphStore>
  const mockFetch = async (filenames: Record<string, unknown>) => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      Object.keys(filenames).map((filename) => ({
        path: filename,
        modified: new Date().getTime(),
        size: 1 // size !== -1 for remote workflows
      }))
    )
    vi.mocked(api).getUserData = vi.fn(
      (f) =>
        ({
          status: 200,
          text: () => JSON.stringify(filenames[f.slice(10)])
        }) as any
    )
    return await store.fetchSubgraphs()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSubgraphStore()
    vi.clearAllMocks()
  })

  it('should allow publishing of a subgraph', async () => {
    //mock canvas to provide a minimal subgraphNode
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    const graph = subgraphNode.graph
    graph.add(subgraphNode)
    vi.mocked(comfyApp.canvas).selectedItems = new Set([subgraphNode])
    vi.mocked(comfyApp.canvas)._serializeItems = vi.fn(() => ({
      nodes: [subgraphNode.serialize()],
      subgraphs: [subgraph.serialize() as any]
    }))
    //mock saving of file
    vi.mocked(api.storeUserData).mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({
          path: 'subgraphs/testname.json',
          modified: Date.now(),
          size: 2
        })
    } as Response)
    await mockFetch({ 'testname.json': mockGraph })
    //Dialogue service already mocked
    await store.publishSubgraph()
    expect(api.storeUserData).toHaveBeenCalled()
  })
  it('should display published nodes in the node library', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(
      useNodeDefStore().nodeDefs.filter(
        (d) => d.category == 'Subgraph Blueprints'
      )
    ).toHaveLength(1)
  })
  it('should allow subgraphs to be edited', async () => {
    await mockFetch({ 'test.json': mockGraph })
    await store.editBlueprint(store.typePrefix + 'test')
    //check active graph
    expect(comfyApp.loadGraphData).toHaveBeenCalled()
  })
  it('should allow subgraphs to be added to graph', async () => {
    //mock
    await mockFetch({ 'test.json': mockGraph })
    const res = useLitegraphService().addNodeOnGraph({
      name: 'SubgraphBlueprint.test'
    } as ComfyNodeDefV1)
    expect(res).toBeTruthy()
  })
})
