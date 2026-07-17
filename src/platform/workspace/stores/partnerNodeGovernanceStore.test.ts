import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PartnerNodePolicyApi from '@/platform/workspace/api/partnerNodePolicyApi'
import type { PartnerNodePolicy } from '@/platform/workspace/api/partnerNodePolicyApi'
import { PartnerNodePolicyApiError } from '@/platform/workspace/api/partnerNodePolicyApi'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const mockGetPartnerNodePolicy = vi.hoisted(() => vi.fn())
const mockUpdatePartnerNodePolicy = vi.hoisted(() => vi.fn())
const mockFlags = vi.hoisted(() => ({
  teamWorkspacesEnabled: true,
  partnerNodeGovernanceEnabled: true
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock(
  '@/platform/workspace/api/partnerNodePolicyApi',
  async (importOriginal) => {
    const actual = await importOriginal<typeof PartnerNodePolicyApi>()
    return {
      ...actual,
      getPartnerNodePolicy: mockGetPartnerNodePolicy,
      updatePartnerNodePolicy: mockUpdatePartnerNodePolicy
    }
  }
)

function nodeDef(
  name: string,
  overrides: Partial<ComfyNodeDef> = {}
): ComfyNodeDef {
  return {
    name,
    display_name: `Display ${name}`,
    category: 'partner/image/Provider',
    python_module: 'comfy_api_nodes.provider',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    api_node: true,
    ...overrides
  }
}

function activateWorkspace(id: string, type: 'personal' | 'team' = 'team') {
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

async function createLoadedStore() {
  const store = usePartnerNodeGovernanceStore()
  await vi.waitFor(() => expect(store.status).not.toBe('loading'))
  return store
}

describe('partnerNodeGovernanceStore', () => {
  let store: ReturnType<typeof usePartnerNodeGovernanceStore> | undefined

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.partnerNodeGovernanceEnabled = true
    mockGetPartnerNodePolicy.mockResolvedValue(null)
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (policy: PartnerNodePolicy) => policy
    )
    activateWorkspace('workspace-one')
    useNodeDefStore().updateNodeDefs([
      nodeDef('AllowedNode'),
      nodeDef('DisabledNode'),
      nodeDef('UnreviewedNode'),
      nodeDef('CoreNode', {
        api_node: false,
        category: 'sampling',
        python_module: 'nodes'
      })
    ])
  })

  afterEach(() => {
    store?.$dispose()
    store = undefined
  })

  it('composes partner-node catalog metadata from object info', async () => {
    useNodeDefStore().updateNodeDefs([
      nodeDef('PartnerNode', {
        display_name: 'Partner Node',
        category: 'partner/video/Acme'
      }),
      nodeDef('CoreNode', { api_node: false })
    ])

    store = await createLoadedStore()

    expect(store.partnerNodes).toEqual([
      { id: 'PartnerNode', name: 'Partner Node', provider: 'Acme' }
    ])
  })

  it('treats 404 as unconfigured and allows every node', async () => {
    store = await createLoadedStore()

    expect(store.status).toBe('unconfigured')
    expect(store.isNodeDisabled('AllowedNode')).toBe(false)
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('does not block nodes while enforcement is off', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: false,
      nodes: { AllowedNode: true, DisabledNode: false }
    } satisfies PartnerNodePolicy)

    store = await createLoadedStore()

    expect(store.isNodeDisabled('AllowedNode')).toBe(false)
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('allows only explicit true rules while enforcement is on', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: true,
      nodes: { AllowedNode: true, DisabledNode: false }
    } satisfies PartnerNodePolicy)

    store = await createLoadedStore()

    expect(store.isNodeDisabled('AllowedNode')).toBe(false)
    expect(store.isNodeDisabled('DisabledNode')).toBe(true)
    expect(store.isNodeDisabled('UnreviewedNode')).toBe(true)
    expect(store.isNodeDisabled('CoreNode')).toBe(false)
  })

  it('fails closed for a 503 from an enforcing workspace', async () => {
    mockGetPartnerNodePolicy.mockRejectedValue(
      new PartnerNodePolicyApiError(503, 'Service Unavailable')
    )

    store = await createLoadedStore()

    expect(store.status).toBe('unavailable')
    expect(store.isNodeDisabled('AllowedNode')).toBe(true)
    expect(store.isNodeDisabled('CoreNode')).toBe(false)
  })

  it('fails open during initial loading and a generic failure', async () => {
    let rejectLoad!: (error: Error) => void
    mockGetPartnerNodePolicy.mockReturnValue(
      new Promise((_, reject) => {
        rejectLoad = reject
      })
    )

    store = usePartnerNodeGovernanceStore()

    expect(store.status).toBe('loading')
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)

    rejectLoad(new Error('Network error'))
    await vi.waitFor(() => expect(store?.status).toBe('error'))

    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('stays fail-closed while retrying an unavailable policy', async () => {
    mockGetPartnerNodePolicy.mockRejectedValueOnce(
      new PartnerNodePolicyApiError(503, 'Service Unavailable')
    )
    store = await createLoadedStore()
    let rejectRetry!: (error: Error) => void
    mockGetPartnerNodePolicy.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRetry = reject
      })
    )

    const retry = store.loadPolicy()

    expect(store.status).toBe('unavailable')
    expect(store.isNodeDisabled('AllowedNode')).toBe(true)
    rejectRetry(new Error('Network error'))
    await retry
    expect(store.status).toBe('unavailable')
    expect(store.isNodeDisabled('AllowedNode')).toBe(true)
  })

  it('preserves the last enforcing policy after a generic refresh error', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: true,
      nodes: { AllowedNode: true, DisabledNode: false }
    } satisfies PartnerNodePolicy)
    store = await createLoadedStore()
    mockGetPartnerNodePolicy.mockRejectedValue(new Error('Network error'))

    await store.loadPolicy()

    expect(store.status).toBe('error')
    expect(store.isNodeDisabled('AllowedNode')).toBe(false)
    expect(store.isNodeDisabled('DisabledNode')).toBe(true)
  })

  it('stays inactive when partner-node governance is disabled', async () => {
    mockFlags.partnerNodeGovernanceEnabled = false

    store = usePartnerNodeGovernanceStore()
    await nextTick()

    expect(mockGetPartnerNodePolicy).not.toHaveBeenCalled()
    expect(store.status).toBe('inactive')
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('stays inactive in a personal workspace', async () => {
    activateWorkspace('personal-workspace', 'personal')

    store = usePartnerNodeGovernanceStore()
    await nextTick()

    expect(mockGetPartnerNodePolicy).not.toHaveBeenCalled()
    expect(store.status).toBe('inactive')
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('ignores a stale response after switching workspaces', async () => {
    let resolveFirst!: (policy: PartnerNodePolicy) => void
    mockGetPartnerNodePolicy
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce({
        enforcementEnabled: true,
        nodes: { DisabledNode: true }
      } satisfies PartnerNodePolicy)
    store = usePartnerNodeGovernanceStore()
    await vi.waitFor(() =>
      expect(mockGetPartnerNodePolicy).toHaveBeenCalledTimes(1)
    )

    activateWorkspace('workspace-two')
    await vi.waitFor(() => expect(store?.status).toBe('configured'))
    resolveFirst({
      enforcementEnabled: true,
      nodes: { DisabledNode: false }
    })
    await nextTick()

    expect(store.governedWorkspaceId).toBe('workspace-two')
    expect(store.isNodeDisabled('DisabledNode')).toBe(false)
  })

  it('saves and installs the validated whole policy', async () => {
    store = await createLoadedStore()
    const nextPolicy = {
      enforcementEnabled: false,
      nodes: { AllowedNode: true, DisabledNode: true }
    } satisfies PartnerNodePolicy

    await expect(store.savePolicy(nextPolicy)).resolves.toBe(true)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith(nextPolicy)
    expect(store.policy).toEqual(nextPolicy)
    expect(store.status).toBe('configured')
  })

  it('does not install a save response after switching workspaces', async () => {
    store = await createLoadedStore()
    let resolveSave!: (policy: PartnerNodePolicy) => void
    mockUpdatePartnerNodePolicy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )

    const save = store.savePolicy({
      enforcementEnabled: false,
      nodes: { AllowedNode: true }
    })
    activateWorkspace('workspace-two')
    await vi.waitFor(() =>
      expect(store?.governedWorkspaceId).toBe('workspace-two')
    )
    resolveSave({
      enforcementEnabled: false,
      nodes: { AllowedNode: true }
    })

    await expect(save).resolves.toBe(false)
    await vi.waitFor(() => expect(store?.status).toBe('unconfigured'))
    expect(store.policy).toBeNull()
  })

  it('refuses to save before governance is ready', async () => {
    mockFlags.partnerNodeGovernanceEnabled = false
    store = usePartnerNodeGovernanceStore()
    await nextTick()

    await expect(
      store.savePolicy({ enforcementEnabled: false, nodes: {} })
    ).rejects.toThrow('Partner node governance is not ready')
    expect(mockUpdatePartnerNodePolicy).not.toHaveBeenCalled()
  })
})
