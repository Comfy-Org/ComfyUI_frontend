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
      getPartnerProviders: mockGetPartnerProviders
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
