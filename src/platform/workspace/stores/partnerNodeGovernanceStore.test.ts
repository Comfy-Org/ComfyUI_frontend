import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PartnerNodePolicyApi from '@/platform/workspace/api/partnerNodePolicyApi'
import type {
  PartnerProvider,
  PartnerProviderPolicy
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

const catalog: PartnerProvider[] = [
  {
    id: 'openai',
    displayName: 'OpenAI (inc. Sora)',
    nodeCategories: ['OpenAI', 'Sora']
  },
  {
    id: 'kling',
    displayName: 'Kling',
    nodeCategories: ['Kling']
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
    mockFlags.teamWorkspacesEnabled = true
    mockFlags.partnerNodeGovernanceEnabled = true
    mockGetPartnerProviders.mockResolvedValue(catalog)
    mockGetPartnerNodePolicy.mockResolvedValue(null)
    mockUpdatePartnerNodePolicy.mockImplementation(
      async (policy: PartnerProviderPolicy) => policy
    )
    activateWorkspace('workspace-one')
  })

  afterEach(() => {
    store?.$dispose()
    store = undefined
  })

  it('loads the server-owned provider catalog', async () => {
    store = await createLoadedStore()

    expect(store.providers).toEqual(catalog)
    expect(store.status).toBe('unconfigured')
  })

  it('initializes every current provider as allowed without enforcement', async () => {
    store = await createLoadedStore()

    expect(store.createInitialPolicy()).toEqual({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'kling', enabled: true }
      ]
    })
  })

  it('treats a provider absent from a configured policy as denied', async () => {
    mockGetPartnerNodePolicy.mockResolvedValue({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    } satisfies PartnerProviderPolicy)

    store = await createLoadedStore()

    expect(store.isProviderEnabled('openai')).toBe(true)
    expect(store.isProviderEnabled('kling')).toBe(false)
  })

  it('hides governance when the backend returns 403', async () => {
    mockGetPartnerNodePolicy.mockRejectedValue(
      new PartnerNodePolicyApiError(403, 'Forbidden')
    )

    store = await createLoadedStore()

    expect(store.status).toBe('ineligible')
    expect(store.providers).toEqual([])
  })

  it('surfaces a temporarily unverifiable policy', async () => {
    mockGetPartnerNodePolicy.mockRejectedValue(
      new PartnerNodePolicyApiError(503, 'Service Unavailable')
    )

    store = await createLoadedStore()

    expect(store.status).toBe('unavailable')
  })

  it('stays inactive outside an eligible team workspace', async () => {
    activateWorkspace('personal', 'personal')

    store = usePartnerNodeGovernanceStore()
    await nextTick()

    expect(mockGetPartnerProviders).not.toHaveBeenCalled()
    expect(mockGetPartnerNodePolicy).not.toHaveBeenCalled()
    expect(store.status).toBe('inactive')
  })

  it('ignores a stale response after switching workspaces', async () => {
    let resolveFirst!: (policy: PartnerProviderPolicy) => void
    mockGetPartnerNodePolicy
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce({
        enforcementEnabled: false,
        providers: [{ providerId: 'kling', enabled: true }]
      } satisfies PartnerProviderPolicy)
    store = usePartnerNodeGovernanceStore()
    await vi.waitFor(() =>
      expect(mockGetPartnerNodePolicy).toHaveBeenCalledTimes(1)
    )

    activateWorkspace('workspace-two')
    await vi.waitFor(() => expect(store?.status).toBe('configured'))
    resolveFirst({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    })
    await nextTick()

    expect(store.governedWorkspaceId).toBe('workspace-two')
    expect(store.policy?.providers).toEqual([
      { providerId: 'kling', enabled: true }
    ])
  })

  it('persists a complete provider policy document', async () => {
    store = await createLoadedStore()
    const nextPolicy = store.createInitialPolicy()

    await expect(store.savePolicy(nextPolicy)).resolves.toBe(true)

    expect(mockUpdatePartnerNodePolicy).toHaveBeenCalledWith(nextPolicy)
    expect(store.status).toBe('configured')
  })
})
