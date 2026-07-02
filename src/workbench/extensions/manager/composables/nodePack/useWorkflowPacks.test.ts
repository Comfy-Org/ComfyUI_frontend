import { createApp, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'

import type * as VueUse from '@vueuse/core'

type GraphNode = {
  type?: string
  properties?: {
    cnr_id?: unknown
    aux_id?: unknown
    ver?: unknown
  }
}
type NodePack = components['schemas']['Node']

const {
  appState,
  nodeDefStore,
  registryStore,
  systemStatsStore,
  nodePacksState,
  nodePacksError,
  nodePacksLoading,
  nodePacksReady,
  startFetch,
  cleanup,
  useNodePacks
} = vi.hoisted(() => ({
  appState: {
    rootGraph: undefined as undefined | { nodes: GraphNode[] }
  },
  nodeDefStore: {
    nodeDefsByName: {} as Record<string, { isCoreNode?: boolean }>
  },
  registryStore: {
    inferPackFromNodeName: { call: vi.fn() }
  },
  systemStatsStore: {
    systemStats: undefined as
      | undefined
      | { system?: { comfyui_version?: string } },
    refetchSystemStats: vi.fn()
  },
  nodePacksState: { value: [] as NodePack[] },
  nodePacksError: { value: undefined as unknown },
  nodePacksLoading: { value: false },
  nodePacksReady: { value: false },
  startFetch: vi.fn(),
  cleanup: vi.fn(),
  useNodePacks: vi.fn()
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    createSharedComposable: <T extends (...args: never[]) => unknown>(fn: T) =>
      fn
  }
})

vi.mock('@/scripts/app', () => ({
  app: appState
}))

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => registryStore
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => nodeDefStore
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: () => systemStatsStore
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  mapAllNodes: (
    graph: { nodes: GraphNode[] },
    mapper: (node: GraphNode) => unknown
  ) => graph.nodes.map(mapper)
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useNodePacks',
  () => ({
    useNodePacks
  })
)

function mountWorkflowPacks() {
  let result: ReturnType<typeof useWorkflowPacks> | undefined
  const app = createApp({
    setup() {
      result = useWorkflowPacks()
      return () => h('div')
    }
  })
  app.mount(document.createElement('div'))
  if (!result) throw new Error('useWorkflowPacks did not initialize')
  return {
    result,
    unmount: () => app.unmount()
  }
}

function node(overrides: GraphNode = {}): GraphNode {
  return {
    type: 'CustomNode',
    properties: {},
    ...overrides
  }
}

function pack(overrides: Partial<NodePack> = {}): NodePack {
  return { id: 'pack-a', ...overrides } as NodePack
}

beforeEach(() => {
  appState.rootGraph = { nodes: [] }
  nodeDefStore.nodeDefsByName = {}
  registryStore.inferPackFromNodeName.call
    .mockReset()
    .mockResolvedValue(undefined)
  systemStatsStore.systemStats = undefined
  systemStatsStore.refetchSystemStats.mockReset().mockResolvedValue(undefined)
  startFetch.mockReset().mockResolvedValue([])
  cleanup.mockReset()
  useNodePacks.mockReset().mockReturnValue({
    error: nodePacksError,
    isLoading: nodePacksLoading,
    isReady: nodePacksReady,
    nodePacks: nodePacksState,
    startFetch,
    cleanup
  })
})

describe('useWorkflowPacks', () => {
  it('fetches explicit workflow packs and trims versions', async () => {
    appState.rootGraph = {
      nodes: [
        node({ properties: { cnr_id: 'pack-a', ver: ' v1.2.3\n' } }),
        node({ properties: { aux_id: 'pack-b' } }),
        node({ properties: { cnr_id: 'comfy-core' } })
      ]
    }
    const { result, unmount } = mountWorkflowPacks()

    await result.startFetchWorkflowPacks()

    expect(useNodePacks).toHaveBeenCalled()
    const idsSource = useNodePacks.mock.calls[0][0]
    expect(idsSource.value).toEqual(['pack-a', 'pack-b'])
    expect(startFetch).toHaveBeenCalledTimes(1)
    expect(
      result.filterWorkflowPack([
        pack({ id: 'pack-a' }),
        pack({ id: 'comfy-core' })
      ])
    ).toEqual([pack({ id: 'pack-a' })])

    unmount()
  })

  it('infers core node packs from system stats', async () => {
    nodeDefStore.nodeDefsByName = { KSampler: { isCoreNode: true } }
    systemStatsStore.systemStats = { system: { comfyui_version: '0.4.0' } }
    appState.rootGraph = { nodes: [node({ type: 'KSampler' })] }
    const { result, unmount } = mountWorkflowPacks()

    await result.startFetchWorkflowPacks()

    const idsSource = useNodePacks.mock.calls[0][0]
    expect(idsSource.value).toEqual(['comfy-core'])
    expect(systemStatsStore.refetchSystemStats).not.toHaveBeenCalled()

    unmount()
  })

  it('refetches system stats and falls back to nightly for core nodes', async () => {
    nodeDefStore.nodeDefsByName = { KSampler: { isCoreNode: true } }
    appState.rootGraph = { nodes: [node({ type: 'KSampler' })] }
    const { result, unmount } = mountWorkflowPacks()

    await result.startFetchWorkflowPacks()

    const idsSource = useNodePacks.mock.calls[0][0]
    expect(idsSource.value).toEqual(['comfy-core'])
    expect(systemStatsStore.refetchSystemStats).toHaveBeenCalled()

    unmount()
  })

  it('infers registry packs and tracks unresolved nodes', async () => {
    registryStore.inferPackFromNodeName.call.mockImplementation(
      (name: string) =>
        name === 'KnownNode'
          ? Promise.resolve({
              id: 'registry-pack',
              latest_version: { version: '3.0.0' }
            })
          : Promise.resolve(undefined)
    )
    appState.rootGraph = {
      nodes: [node({ type: 'KnownNode' }), node({ type: 'MissingNode' })]
    }
    const { result, unmount } = mountWorkflowPacks()

    await result.startFetchWorkflowPacks()

    const idsSource = useNodePacks.mock.calls[0][0]
    expect(idsSource.value).toEqual(['registry-pack'])
    expect(result.unresolvedNodeNames.value).toEqual(['MissingNode'])

    unmount()
  })

  it('resets workflow packs when no graph is ready and cleans up on unmount', async () => {
    appState.rootGraph = undefined
    const { result, unmount } = mountWorkflowPacks()

    await result.startFetchWorkflowPacks()
    unmount()

    const idsSource = useNodePacks.mock.calls[0][0]
    expect(idsSource.value).toEqual([])
    expect(cleanup).toHaveBeenCalled()
  })
})
