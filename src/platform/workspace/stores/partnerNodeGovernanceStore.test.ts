import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PartnerNodePolicyApi from '@/platform/workspace/api/partnerNodePolicyApi'
import type {
  PartnerNodePolicy,
  PartnerProvider
} from '@/platform/workspace/api/partnerNodePolicyApi'
import { PartnerNodePolicyApiError } from '@/platform/workspace/api/partnerNodePolicyApi'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const mockGetPartnerNodePolicy = vi.hoisted(() => vi.fn())
const mockGetPartnerProviders = vi.hoisted(() => vi.fn())
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
      getPartnerProviders: mockGetPartnerProviders,
      updatePartnerNodePolicy: mockUpdatePartnerNodePolicy
    }
  }
)

const providers: PartnerProvider[] = [
  {
    id: 'openai',
    displayName: 'OpenAI (inc. Sora)',
    nodeCategories: ['OpenAI', 'Sora']
  },
  {
    id: 'route-only',
    displayName: 'Route only',
    nodeCategories: []
  }
]

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
    mockUpdatePartnerNodePolicy.mockReset()
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.partnerNodeGovernanceEnabled = true
    mockGetPartnerProviders.mockResolvedValue(providers)
    mockGetPartnerNodePolicy.mockResolvedValue(null)
    activateWorkspace('workspace-one')
  })

  afterEach(() => {
    store?.$dispose()
    store = undefined
  })

  it('loads the provider catalog and configured policy together', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    } satisfies PartnerNodePolicy)

    store = await createLoadedStore()

    expect(store.status).toBe('configured')
    expect(store.providers).toEqual(providers)
    expect(store.isProviderEnabled('openai')).toBe(false)
    expect(store.isProviderEnabled('route-only')).toBe(false)
  })

  it('builds an unrestricted initial policy from every catalog provider', async () => {
    store = await createLoadedStore()

    expect(store.status).toBe('unconfigured')
    expect(store.isProviderEnabled('openai')).toBe(true)
    expect(store.createInitialPolicy()).toEqual({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'route-only', enabled: true }
      ]
    })
  })

  it('hides governance when the backend reports an ineligible workspace', async () => {
    mockGetPartnerProviders.mockRejectedValue(
      new PartnerNodePolicyApiError(403, 'Forbidden')
    )

    store = await createLoadedStore()

    expect(store.status).toBe('ineligible')
    expect(store.providers).toEqual([])
  })

  it('saves the server-normalized policy', async () => {
    const requestedPolicy: PartnerNodePolicy = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    const savedPolicy: PartnerNodePolicy = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    mockUpdatePartnerNodePolicy.mockResolvedValue(savedPolicy)
    store = await createLoadedStore()

    await store.savePolicy(requestedPolicy)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith(requestedPolicy)
    expect(store.policy).toEqual(savedPolicy)
    expect(store.status).toBe('configured')
    expect(store.isSaving).toBe(false)
  })

  it.for([
    {
      id: 'workspace-two',
      type: 'team',
      expectedStatus: 'unconfigured',
      expectedWorkspaceId: 'workspace-two'
    },
    {
      id: 'personal-workspace',
      type: 'personal',
      expectedStatus: 'inactive',
      expectedWorkspaceId: null
    }
  ] as const)(
    'clears saving state after switching to a $type workspace',
    async ({ id, type, expectedStatus, expectedWorkspaceId }) => {
      let resolveSave!: (policy: PartnerNodePolicy) => void
      const savedPolicy: PartnerNodePolicy = {
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: true }]
      }
      mockUpdatePartnerNodePolicy.mockReturnValue(
        new Promise((resolve) => {
          resolveSave = resolve
        })
      )
      store = await createLoadedStore()

      const savePromise = store.savePolicy(store.createInitialPolicy())
      expect(store.isSaving).toBe(true)

      activateWorkspace(id, type)
      await vi.waitFor(() => expect(store?.status).toBe(expectedStatus))

      expect(store.isSaving).toBe(false)

      resolveSave(savedPolicy)
      await savePromise

      expect(store.governedWorkspaceId).toBe(expectedWorkspaceId)
      expect(store.policy).toBeNull()
    }
  )

  it('ignores a save response after switching away and back', async () => {
    let resolveSave!: (policy: PartnerNodePolicy) => void
    const savedPolicy: PartnerNodePolicy = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockUpdatePartnerNodePolicy.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    store = await createLoadedStore()

    const savePromise = store.savePolicy(store.createInitialPolicy())
    activateWorkspace('workspace-two')
    await vi.waitFor(() => expect(store?.status).toBe('unconfigured'))
    activateWorkspace('workspace-one')
    await vi.waitFor(() => expect(store?.status).toBe('unconfigured'))

    resolveSave(savedPolicy)
    await savePromise

    expect(store.policy).toBeNull()
  })

  it('rejects an overlapping save after a same-workspace reload', async () => {
    let resolveSave!: (policy: PartnerNodePolicy) => void
    mockUpdatePartnerNodePolicy
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve
        })
      )
      .mockResolvedValueOnce({
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: false }]
      } satisfies PartnerNodePolicy)
    store = await createLoadedStore()
    const acceptedPolicy = store.createInitialPolicy()

    const savePromise = store.savePolicy(acceptedPolicy)
    mockGetPartnerNodePolicy.mockResolvedValueOnce(acceptedPolicy)
    await store.loadPolicy()

    expect(store.isSaving).toBe(true)
    await expect(
      store.savePolicy({
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: false }]
      })
    ).rejects.toThrow('Provider policy save already in progress')
    const saveCallCount = mockUpdatePartnerNodePolicy.mock.calls.length

    resolveSave(acceptedPolicy)
    await savePromise

    expect(saveCallCount).toBe(1)
    expect(store.policy).toEqual(acceptedPolicy)
    expect(store.isSaving).toBe(false)
  })

  it('ignores a load response after a save completes', async () => {
    let resolveLoad!: (policy: PartnerNodePolicy | null) => void
    const savedPolicy: PartnerNodePolicy = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    store = await createLoadedStore()
    mockGetPartnerNodePolicy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve
      })
    )
    mockUpdatePartnerNodePolicy.mockResolvedValue(savedPolicy)

    const loadPromise = store.loadPolicy()
    await vi.waitFor(() => expect(store?.status).toBe('loading'))
    await store.savePolicy(store.createInitialPolicy())
    expect(store.policy).toEqual(savedPolicy)
    resolveLoad({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    })
    await loadPromise

    expect(store.policy).toEqual(savedPolicy)
  })

  it('creates the initial document when the first provider is changed', async () => {
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (nextPolicy: PartnerNodePolicy) => nextPolicy
    )
    store = await createLoadedStore()

    await store.setProviderEnabled('openai', false)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: false },
        { providerId: 'route-only', enabled: true }
      ]
    })
  })

  it('preserves existing policy entries when one provider is changed', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'route-only', enabled: false }
      ]
    } satisfies PartnerNodePolicy)
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (nextPolicy: PartnerNodePolicy) => nextPolicy
    )
    store = await createLoadedStore()

    await store.setProviderEnabled('openai', false)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: false },
        { providerId: 'route-only', enabled: false }
      ]
    })
  })

  it('applies bulk changes to every catalog provider', async () => {
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (nextPolicy: PartnerNodePolicy) => nextPolicy
    )
    store = await createLoadedStore()

    await store.setAllProvidersEnabled(false)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: false },
        { providerId: 'route-only', enabled: false }
      ]
    })
  })

  it('changes enforcement without changing provider review state', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: false },
        { providerId: 'route-only', enabled: true }
      ]
    } satisfies PartnerNodePolicy)
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (nextPolicy: PartnerNodePolicy) => nextPolicy
    )
    store = await createLoadedStore()

    await store.setEnforcementEnabled(true)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: false },
        { providerId: 'route-only', enabled: true }
      ]
    })
  })

  it('creates the initial policy when enforcement changes', async () => {
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (nextPolicy: PartnerNodePolicy) => nextPolicy
    )
    store = await createLoadedStore()

    await store.setEnforcementEnabled(true)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'route-only', enabled: true }
      ]
    })
  })

  it('reloads the catalog after an unknown-provider response', async () => {
    mockUpdatePartnerNodePolicy.mockRejectedValue(
      new PartnerNodePolicyApiError(422, 'Unprocessable Entity')
    )
    store = await createLoadedStore()
    mockGetPartnerProviders.mockClear()
    mockGetPartnerNodePolicy.mockClear()

    await expect(store.savePolicy(store.createInitialPolicy())).rejects.toEqual(
      new PartnerNodePolicyApiError(422, 'Unprocessable Entity')
    )

    expect(mockGetPartnerProviders).toHaveBeenCalledOnce()
    expect(mockGetPartnerNodePolicy).toHaveBeenCalledOnce()
    expect(store.isSaving).toBe(false)
  })

  it('stays inactive when partner-provider governance is disabled', async () => {
    mockFlags.partnerNodeGovernanceEnabled = false

    store = usePartnerNodeGovernanceStore()
    await nextTick()

    expect(mockGetPartnerProviders).not.toHaveBeenCalled()
    expect(mockGetPartnerNodePolicy).not.toHaveBeenCalled()
    expect(store.status).toBe('inactive')
  })

  it('stays inactive in a personal workspace', async () => {
    activateWorkspace('personal-workspace', 'personal')

    store = usePartnerNodeGovernanceStore()
    await nextTick()

    expect(mockGetPartnerProviders).not.toHaveBeenCalled()
    expect(mockGetPartnerNodePolicy).not.toHaveBeenCalled()
    expect(store.status).toBe('inactive')
  })

  it('ignores a stale response after switching workspaces', async () => {
    let resolveFirst!: (policy: PartnerNodePolicy | null) => void
    mockGetPartnerNodePolicy
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce({
        enforcementEnabled: true,
        providers: [{ providerId: 'openai', enabled: true }]
      } satisfies PartnerNodePolicy)
    store = usePartnerNodeGovernanceStore()
    await vi.waitFor(() =>
      expect(mockGetPartnerNodePolicy).toHaveBeenCalledTimes(1)
    )

    activateWorkspace('workspace-two')
    await vi.waitFor(() => expect(store?.status).toBe('configured'))
    resolveFirst({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    })
    await nextTick()

    expect(store.governedWorkspaceId).toBe('workspace-two')
    expect(store.isProviderEnabled('openai')).toBe(true)
  })
})
