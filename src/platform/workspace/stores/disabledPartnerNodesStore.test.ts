import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { PartnerNode } from '@/platform/workspace/api/partnerNodesApi'
import { partnerNodesApi } from '@/platform/workspace/api/partnerNodesApi'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDisabledPartnerNodesStore } from '@/platform/workspace/stores/disabledPartnerNodesStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  createMockLGraph,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

const mockAppState = vi.hoisted(() => ({
  isGraphReady: false,
  rootGraph: null as unknown
}))
const mockGraphChangedListeners = vi.hoisted(() => new Set<() => void>())
const devPartnerNodeType = 'DevPartnerNode'
const extensionHiddenNodeType = 'ExtensionHiddenPartnerNode'
const mockFeatureFlags = vi.hoisted(() => ({
  teamWorkspacesEnabled: true,
  partnerNodeGovernanceEnabled: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFeatureFlags })
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback,
  t: (key: string) => key
}))

vi.mock('@/platform/workspace/api/partnerNodesApi', () => ({
  partnerNodesApi: { list: vi.fn() }
}))

vi.mock('@/scripts/app', () => ({
  app: mockAppState
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      mockGraphChangedListeners.add(listener)
    }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => {
      mockGraphChangedListeners.delete(listener)
    })
  }
}))

function partnerNode(overrides: Partial<PartnerNode>): PartnerNode {
  return {
    id: 'StableNodeId',
    name: 'Display name',
    partner: 'Provider',
    last_modified: null,
    enabled: true,
    ...overrides
  }
}

function nodeDef(name: string, apiNode = true) {
  return { name, display_name: `Display ${name}`, api_node: apiNode }
}

function completeNodeDef(name: string, devOnly = false): ComfyNodeDef {
  return {
    name,
    display_name: `Display ${name}`,
    category: 'api/provider',
    python_module: 'comfy_api_nodes.provider',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    api_node: true,
    dev_only: devOnly
  }
}

function graphWithNodes(nodes: LGraphNode[], isRootGraph = true) {
  const graph = createMockLGraph({
    nodes,
    isRootGraph,
    getNodeById: (id) =>
      nodes.find((node) => String(node.id) === String(id)) ?? null
  })
  for (const node of nodes) node.graph = graph
  return graph
}

function activateWorkspace(id: string, type: 'personal' | 'team') {
  const store = useTeamWorkspaceStore()
  store.workspaces = [
    {
      id,
      name: id,
      type,
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null,
      members: [],
      pendingInvites: []
    }
  ]
  store.activeWorkspaceId = id
}

describe('disabledPartnerNodesStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
    activateWorkspace('team-workspace', 'team')
    mockAppState.isGraphReady = false
    mockAppState.rootGraph = null
    mockGraphChangedListeners.clear()
    mockFeatureFlags.teamWorkspacesEnabled = true
    mockFeatureFlags.partnerNodeGovernanceEnabled = true
  })

  afterEach(() => {
    vi.useRealTimers()
    if (LiteGraph.registered_node_types[devPartnerNodeType]) {
      LiteGraph.unregisterNodeType(devPartnerNodeType)
    }
    if (LiteGraph.registered_node_types[extensionHiddenNodeType]) {
      LiteGraph.unregisterNodeType(extensionHiddenNodeType)
    }
  })

  it('allows only positively verified node type IDs', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [
        partnerNode({ id: 'EnabledNode', enabled: true }),
        partnerNode({ id: 'DisabledNode', enabled: false })
      ],
      auto_enable_new: false
    })
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(store.isNodeDefDisabled(nodeDef('EnabledNode'))).toBe(false)
    expect(store.isNodeDefDisabled(nodeDef('DisabledNode'))).toBe(true)
    expect(store.isNodeDefDisabled(nodeDef('NewCatalogNode'))).toBe(true)
    expect(store.isNodeDefDisabled(nodeDef('CoreNode', false))).toBe(false)
  })

  it('fails closed before and after policy verification fails', async () => {
    vi.mocked(partnerNodesApi.list).mockRejectedValue(
      new Error('policy unavailable')
    )
    const store = useDisabledPartnerNodesStore()

    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(true)

    await expect(store.applyGovernanceChange()).rejects.toThrow(
      'Failed to refresh Partner Node governance policy'
    )

    expect(store.policyState).toBe('failed')
    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(true)
  })

  it('fails closed during same-workspace policy refreshes', async () => {
    let resolveRefresh!: (response: {
      partner_nodes: PartnerNode[]
      auto_enable_new: boolean
    }) => void
    vi.mocked(partnerNodesApi.list)
      .mockResolvedValueOnce({
        partner_nodes: [partnerNode({ id: 'PartnerNode', enabled: true })],
        auto_enable_new: false
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
      )
    const store = useDisabledPartnerNodesStore()
    await store.applyGovernanceChange()

    const refresh = store.applyGovernanceChange()
    await vi.waitFor(() =>
      expect(partnerNodesApi.list).toHaveBeenCalledTimes(2)
    )

    expect(store.policyState).toBe('loading')
    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(true)

    resolveRefresh({
      partner_nodes: [partnerNode({ id: 'PartnerNode', enabled: true })],
      auto_enable_new: false
    })
    await refresh

    expect(store.policyState).toBe('verified')
    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(false)
  })

  it('does not apply governance to personal workspaces', async () => {
    activateWorkspace('personal-workspace', 'personal')
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(partnerNodesApi.list).not.toHaveBeenCalled()
    expect(store.policyState).toBe('inactive')
    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(false)
  })

  it('does not enforce governance before rollout is enabled', async () => {
    mockFeatureFlags.partnerNodeGovernanceEnabled = false
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(partnerNodesApi.list).not.toHaveBeenCalled()
    expect(store.policyState).toBe('inactive')
    expect(store.isNodeDefDisabled(nodeDef('PartnerNode'))).toBe(false)
  })

  it('composes governance and dev-only discovery visibility', async () => {
    vi.mocked(partnerNodesApi.list)
      .mockResolvedValueOnce({
        partner_nodes: [partnerNode({ id: devPartnerNodeType })],
        auto_enable_new: false
      })
      .mockResolvedValueOnce({
        partner_nodes: [
          partnerNode({ id: devPartnerNodeType, enabled: false })
        ],
        auto_enable_new: false
      })
    const nodeDefStore = useNodeDefStore()
    nodeDefStore.updateNodeDefs([completeNodeDef(devPartnerNodeType, true)])
    class DevPartnerNode extends LGraphNode {}
    DevPartnerNode.nodeData = nodeDefStore.nodeDefsByName[devPartnerNodeType]
    LiteGraph.registerNodeType(devPartnerNodeType, DevPartnerNode)
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(DevPartnerNode.skip_list).toBe(true)

    useSettingStore().settingValues['Comfy.DevMode'] = true
    await nextTick()

    expect(DevPartnerNode.skip_list).toBe(false)

    await store.applyGovernanceChange()
    useSettingStore().settingValues['Comfy.DevMode'] = false
    await nextTick()
    useSettingStore().settingValues['Comfy.DevMode'] = true
    await nextTick()

    expect(DevPartnerNode.skip_list).toBe(true)
  })

  it('preserves extension-owned discovery visibility', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [partnerNode({ id: extensionHiddenNodeType })],
      auto_enable_new: false
    })
    const nodeDefStore = useNodeDefStore()
    nodeDefStore.updateNodeDefs([completeNodeDef(extensionHiddenNodeType)])
    class ExtensionHiddenPartnerNode extends LGraphNode {}
    ExtensionHiddenPartnerNode.nodeData =
      nodeDefStore.nodeDefsByName[extensionHiddenNodeType]
    LiteGraph.registerNodeType(
      extensionHiddenNodeType,
      ExtensionHiddenPartnerNode
    )
    ExtensionHiddenPartnerNode.skip_list = true
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(ExtensionHiddenPartnerNode.skip_list).toBe(true)
  })

  it('preserves extension visibility changes made after governance sync', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [partnerNode({ id: extensionHiddenNodeType })],
      auto_enable_new: false
    })
    const nodeDefStore = useNodeDefStore()
    nodeDefStore.updateNodeDefs([completeNodeDef(extensionHiddenNodeType)])
    class ExtensionHiddenPartnerNode extends LGraphNode {}
    ExtensionHiddenPartnerNode.nodeData =
      nodeDefStore.nodeDefsByName[extensionHiddenNodeType]
    LiteGraph.registerNodeType(
      extensionHiddenNodeType,
      ExtensionHiddenPartnerNode
    )
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()
    ExtensionHiddenPartnerNode.skip_list = true
    await store.applyGovernanceChange()

    expect(ExtensionHiddenPartnerNode.skip_list).toBe(true)
  })

  it('surfaces disabled canvas nodes as policy offenders', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [partnerNode({ id: 'AllowedNode', enabled: true })],
      auto_enable_new: false
    })
    useNodeDefStore().updateNodeDefs([
      completeNodeDef('AllowedNode'),
      completeNodeDef('DisabledNode')
    ])
    const graphNode = createMockLGraphNode({ type: 'DisabledNode' })
    const graph = graphWithNodes([graphNode])
    mockAppState.isGraphReady = true
    mockAppState.rootGraph = graph
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(store.offenders).toEqual([
      expect.objectContaining({
        nodeId: String(graphNode.id),
        displayName: 'Display DisabledNode'
      })
    ])
  })

  it.for([LGraphEventMode.NEVER, LGraphEventMode.BYPASS])(
    'ignores disabled nodes with non-executable mode %s',
    async (mode) => {
      vi.mocked(partnerNodesApi.list).mockResolvedValue({
        partner_nodes: [],
        auto_enable_new: false
      })
      useNodeDefStore().updateNodeDefs([completeNodeDef('DisabledNode')])
      const graphNode = createMockLGraphNode({
        type: 'DisabledNode',
        mode
      })
      const graph = graphWithNodes([graphNode])
      mockAppState.isGraphReady = true
      mockAppState.rootGraph = graph
      const store = useDisabledPartnerNodesStore()

      await store.applyGovernanceChange()

      expect(store.offenders).toEqual([])
    }
  )

  it('ignores disabled nodes under inactive subgraphs', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [],
      auto_enable_new: false
    })
    useNodeDefStore().updateNodeDefs([completeNodeDef('DisabledNode')])
    const innerNode = createMockLGraphNode({ type: 'DisabledNode' })
    const childGraph = graphWithNodes([innerNode], false)
    const subgraphNode = createMockLGraphNode({
      mode: LGraphEventMode.NEVER,
      isSubgraphNode: () => true,
      subgraph: childGraph
    })
    const rootGraph = graphWithNodes([subgraphNode])
    mockAppState.isGraphReady = true
    mockAppState.rootGraph = rootGraph
    const store = useDisabledPartnerNodesStore()

    await store.applyGovernanceChange()

    expect(store.offenders).toEqual([])
  })

  it('fails closed while loading and reconciles after verification', async () => {
    let resolvePolicy!: (response: {
      partner_nodes: PartnerNode[]
      auto_enable_new: boolean
    }) => void
    vi.mocked(partnerNodesApi.list).mockReturnValue(
      new Promise((resolve) => {
        resolvePolicy = resolve
      })
    )
    useNodeDefStore().updateNodeDefs([completeNodeDef('PartnerNode')])
    const graphNode = createMockLGraphNode({ type: 'PartnerNode' })
    const graph = graphWithNodes([graphNode])
    mockAppState.isGraphReady = true
    mockAppState.rootGraph = graph
    const store = useDisabledPartnerNodesStore()

    const surface = store.surfaceDisabledNodes({ silent: true })
    await vi.waitFor(() => expect(partnerNodesApi.list).toHaveBeenCalled())

    expect(store.policyState).toBe('loading')
    expect(store.offenders).toHaveLength(1)

    resolvePolicy({
      partner_nodes: [partnerNode({ id: 'PartnerNode', enabled: true })],
      auto_enable_new: false
    })
    await surface

    expect(store.policyState).toBe('verified')
    expect(store.offenders).toEqual([])
  })

  it('notifies when a loaded workflow contains disabled nodes', async () => {
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [],
      auto_enable_new: false
    })
    useNodeDefStore().updateNodeDefs([completeNodeDef('DisabledNode')])
    const graphNode = createMockLGraphNode({ type: 'DisabledNode' })
    const graph = graphWithNodes([graphNode])
    mockAppState.isGraphReady = true
    mockAppState.rootGraph = graph
    const store = useDisabledPartnerNodesStore()

    await store.surfaceDisabledNodes()

    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({ severity: 'error', group: 'disabled-nodes' })
    ])
  })

  it('refreshes and replaces policy when the active workspace changes', async () => {
    vi.mocked(partnerNodesApi.list)
      .mockResolvedValueOnce({
        partner_nodes: [partnerNode({ id: 'FirstNode', enabled: true })],
        auto_enable_new: false
      })
      .mockResolvedValueOnce({
        partner_nodes: [partnerNode({ id: 'SecondNode', enabled: true })],
        auto_enable_new: false
      })
    const store = useDisabledPartnerNodesStore()
    await store.applyGovernanceChange()

    activateWorkspace('second-team-workspace', 'team')

    await vi.waitFor(() =>
      expect(partnerNodesApi.list).toHaveBeenCalledTimes(2)
    )
    await vi.waitFor(() =>
      expect(store.isNodeDefDisabled(nodeDef('SecondNode'))).toBe(false)
    )
    expect(store.isNodeDefDisabled(nodeDef('FirstNode'))).toBe(true)
  })

  it('rescans after nodes are added or removed', async () => {
    vi.useFakeTimers()
    vi.mocked(partnerNodesApi.list).mockResolvedValue({
      partner_nodes: [partnerNode({ id: 'AllowedNode', enabled: true })],
      auto_enable_new: false
    })
    useNodeDefStore().updateNodeDefs([completeNodeDef('DisabledNode')])
    const graph = graphWithNodes([])
    mockAppState.isGraphReady = true
    mockAppState.rootGraph = graph
    const store = useDisabledPartnerNodesStore()
    await store.applyGovernanceChange()

    const graphNode = createMockLGraphNode({ type: 'DisabledNode' })
    graphNode.graph = graph
    graph.nodes.push(graphNode)
    mockGraphChangedListeners.forEach((listener) => listener())
    await vi.advanceTimersByTimeAsync(250)

    expect(store.offenders).toHaveLength(1)

    graph.nodes.splice(graph.nodes.indexOf(graphNode), 1)
    mockGraphChangedListeners.forEach((listener) => listener())
    await vi.advanceTimersByTimeAsync(250)

    expect(store.offenders).toEqual([])
  })
})
