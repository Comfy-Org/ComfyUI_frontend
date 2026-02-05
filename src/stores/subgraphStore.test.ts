import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import type { GlobalSubgraphData } from '@/scripts/api'
import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createTestingPinia } from '@pinia/testing'

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
    getGlobalSubgraphs: vi.fn(),
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
  async function mockFetch(
    filenames: Record<string, unknown>,
    globalSubgraphs: Record<string, GlobalSubgraphData> = {}
  ) {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      Object.keys(filenames).map((filename) => ({
        path: filename,
        modified: new Date().getTime(),
        size: 1 // size !== -1 for remote workflows
      }))
    )
    vi.mocked(api).getUserData = vi.fn((f) =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify(filenames[f.slice(10)]))
      } as Response)
    )
    vi.mocked(api.getGlobalSubgraphs).mockResolvedValue(globalSubgraphs)
    return await store.fetchSubgraphs()
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
    vi.mocked(comfyApp.canvas)._serializeItems = vi.fn(() => {
      const serializedSubgraph = {
        ...subgraph.serialize(),
        links: [],
        groups: [],
        version: 1
      } as Partial<ExportedSubgraph> as ExportedSubgraph
      return {
        nodes: [subgraphNode.serialize()],
        subgraphs: [serializedSubgraph]
      }
    })
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
        (d) => d.category === 'Subgraph Blueprints/User'
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
  it('should identify user blueprints as non-global', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(store.isGlobalBlueprint('test')).toBe(false)
  })
  it('should identify global blueprints loaded from getGlobalSubgraphs', async () => {
    await mockFetch(
      {},
      {
        global_test: {
          name: 'Global Test Blueprint',
          info: { node_pack: 'comfy_essentials' },
          data: JSON.stringify(mockGraph)
        }
      }
    )
    expect(store.isGlobalBlueprint('global_test')).toBe(true)
  })
  it('should return false for non-existent blueprints', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(store.isGlobalBlueprint('nonexistent')).toBe(false)
  })
})
