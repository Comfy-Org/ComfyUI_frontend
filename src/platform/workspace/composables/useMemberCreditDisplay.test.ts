import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMemberCreditDisplay } from '@/platform/workspace/composables/useMemberCreditDisplay'

const SELF = 'member@example.com'

const mocks = vi.hoisted(() => ({
  members: null as { value: unknown[] } | null,
  balanceCents: null as { value: number } | null,
  isInPersonalWorkspace: null as { value: boolean } | null
}))

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { computed } = await import('vue')
  return { useCurrentUser: () => ({ userEmail: computed(() => SELF) }) }
})

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { computed, ref } = await import('vue')
  const balanceCents = ref(0)
  mocks.balanceCents = balanceCents
  return {
    useBillingContext: () => ({
      balance: computed(() => ({
        effectiveBalanceMicros: balanceCents.value
      }))
    })
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', async () => {
  const { ref } = await import('vue')
  const members = ref<unknown[]>([])
  const isInPersonalWorkspace = ref(false)
  mocks.members = members
  mocks.isInPersonalWorkspace = isInPersonalWorkspace
  return {
    useTeamWorkspaceStore: () => ({
      members,
      isInPersonalWorkspace,
      activeWorkspaceId: ref('ws-1'),
      ensureMembersLoaded: vi.fn()
    })
  }
})

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store
}))

/** The harness stores cents; 211 credits to the dollar. */
function creditsToCents(credits: number) {
  return Math.round((credits * 100) / 211)
}

function setup({
  role = 'member',
  limit = null as number | null,
  used = 0,
  balanceCredits = 50_000
} = {}) {
  mocks.members!.value = [
    {
      email: SELF,
      role,
      monthlyCreditLimit: limit,
      creditsUsedThisMonth: used
    }
  ]
  mocks.balanceCents!.value = creditsToCents(balanceCredits)
  return useMemberCreditDisplay()
}

describe('useMemberCreditDisplay', () => {
  beforeEach(() => {
    mocks.isInPersonalWorkspace!.value = false
  })

  describe('capped member', () => {
    it('shows their remaining limit while the pool is healthy', () => {
      const { displayedNumber, isEdgeState, requestAction } = setup({
        limit: 3000,
        used: 1234
      })
      expect(Math.round(displayedNumber.value)).toBe(1766)
      expect(isEdgeState.value).toBe(false)
      expect(requestAction.value).toBeNull()
    })

    it('substitutes the pool when it is the smaller number, and explains it', () => {
      const { displayedNumber, isEdgeState, requestAction } = setup({
        limit: 3000,
        used: 1234,
        balanceCredits: 1500
      })
      expect(Math.round(displayedNumber.value)).toBe(1500)
      expect(isEdgeState.value).toBe(true)
      // No button in the edge state: a limit increase cannot help while the
      // pool is what binds.
      expect(requestAction.value).toBeNull()
    })

    it('subtracts spend before comparing, not after', () => {
      // limit 3000 vs pool 700 would show 700 if spend were applied after the
      // min; their real remaining is 500, which is smaller and must win.
      const { displayedNumber, isEdgeState } = setup({
        limit: 3000,
        used: 2500,
        balanceCredits: 700
      })
      expect(Math.round(displayedNumber.value)).toBe(500)
      expect(isEdgeState.value).toBe(false)
    })

    it('offers a limit increase once the cap is spent', () => {
      const { displayedNumber, isLimitReached, requestAction } = setup({
        limit: 3000,
        used: 3000
      })
      expect(Math.round(displayedNumber.value)).toBe(0)
      expect(isLimitReached.value).toBe(true)
      expect(requestAction.value).toBe('requestLimitIncrease')
    })

    it('offers a limit increase below the request floor', () => {
      const { requestAction } = setup({ limit: 3000, used: 2000 })
      expect(requestAction.value).toBe('requestLimitIncrease')
    })
  })

  describe('uncapped member', () => {
    it('shows the workspace balance with no request path', () => {
      const { memberCap, displayedNumber, requestAction } = setup({
        limit: null,
        balanceCredits: 36_450
      })
      expect(memberCap.value).toBeNull()
      expect(Math.round(displayedNumber.value)).toBe(36_450)
      expect(requestAction.value).toBeNull()
    })

    it('still has no request path when the balance is merely low', () => {
      // Uncapped members have exactly two states; low balance is not one.
      const { requestAction } = setup({ limit: null, balanceCredits: 900 })
      expect(requestAction.value).toBeNull()
    })
  })

  describe('workspace out of credits', () => {
    it('outranks limit-reached and routes to the owner', () => {
      const { isWorkspaceOut, isLimitReached, requestAction } = setup({
        limit: 3000,
        used: 3000,
        balanceCredits: 0
      })
      expect(isWorkspaceOut.value).toBe(true)
      // Raising the cap would not help when the pool is dry.
      expect(isLimitReached.value).toBe(false)
      expect(requestAction.value).toBe('notifyOwner')
    })

    it('applies to uncapped members too', () => {
      const { requestAction } = setup({ limit: null, balanceCredits: 0 })
      expect(requestAction.value).toBe('notifyOwner')
    })
  })

  describe('viewers who are not capped members', () => {
    it('gives owners no cap and no request button', () => {
      const { memberCap, requestAction } = setup({
        role: 'owner',
        limit: 3000,
        balanceCredits: 0
      })
      expect(memberCap.value).toBeNull()
      expect(requestAction.value).toBeNull()
    })

    it('does not apply in a personal workspace', () => {
      const display = setup({ limit: 3000, used: 3000 })
      mocks.isInPersonalWorkspace!.value = true
      expect(display.memberCap.value).toBeNull()
      expect(display.requestAction.value).toBeNull()
    })
  })
})
