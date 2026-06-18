import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockIsInPersonalWorkspace,
  mockIsWorkspaceSubscribed,
  mockSubscription
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockIsInPersonalWorkspace: ref(false),
    mockIsWorkspaceSubscribed: ref(true),
    mockSubscription: ref<{ isCancelled?: boolean } | null>({
      isCancelled: false
    })
  }
})

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ subscription: mockSubscription })
}))

async function setup() {
  const { useTeamPlan } = await import('./useTeamPlan')
  return useTeamPlan()
}

describe('useTeamPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInPersonalWorkspace.value = false
    mockIsWorkspaceSubscribed.value = true
    mockSubscription.value = { isCancelled: false }
  })

  it('is on the team plan for a subscribed team workspace', async () => {
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(true)
  })

  it('is off the team plan in a personal workspace', async () => {
    mockIsInPersonalWorkspace.value = true
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('is off the team plan when the team workspace is not subscribed', async () => {
    mockIsWorkspaceSubscribed.value = false
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('reflects the cancelled state of the subscription', async () => {
    const plan = await setup()
    expect(plan.isCancelled.value).toBe(false)
    mockSubscription.value = { isCancelled: true }
    expect(plan.isCancelled.value).toBe(true)
  })

  it('treats a missing subscription as not cancelled', async () => {
    mockSubscription.value = null
    const plan = await setup()
    expect(plan.isCancelled.value).toBe(false)
  })
})
