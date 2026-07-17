import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockIsInPersonalWorkspace,
  mockIsWorkspaceSubscribed,
  mockSubscription,
  mockSubscriptionStatus
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockIsInPersonalWorkspace: ref(false),
    mockIsWorkspaceSubscribed: ref(true),
    mockSubscription: ref<{ isCancelled?: boolean } | null>({
      isCancelled: false
    }),
    mockSubscriptionStatus: ref<string | null>('active')
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
  useBillingContext: () => ({
    subscription: mockSubscription,
    subscriptionStatus: mockSubscriptionStatus
  })
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
    mockSubscriptionStatus.value = 'active'
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

  it('does not flag a lapsed plan while the team subscription is active', async () => {
    const plan = await setup()
    expect(plan.hasLapsedTeamPlan.value).toBe(false)
  })

  it('flags a lapsed plan when the team subscription is cancelled or ended', async () => {
    const plan = await setup()
    mockSubscriptionStatus.value = 'canceled'
    expect(plan.hasLapsedTeamPlan.value).toBe(true)
    mockSubscriptionStatus.value = 'ended'
    expect(plan.hasLapsedTeamPlan.value).toBe(true)
  })

  it('does not flag a lapsed plan in a personal workspace', async () => {
    mockIsInPersonalWorkspace.value = true
    mockSubscriptionStatus.value = 'canceled'
    const plan = await setup()
    expect(plan.hasLapsedTeamPlan.value).toBe(false)
  })
})
