import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  ReactivationConfirmationRequiredError,
  useDowngradeToPersonal
} from './useDowngradeToPersonal'

const mockMembers = ref<WorkspaceMember[]>([])
const mockUserEmail = ref<string | null>(null)
const mockSubscription = ref<{ isCancelled: boolean } | null>(null)
const mockIsInitialized = ref(true)
const mockRemoveMember = vi.hoisted(() => vi.fn())
const mockFetchMembers = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn())
const mockPreviewSubscribe = vi.hoisted(() => vi.fn())
const mockFetchStatus = vi.hoisted(() => vi.fn())
const mockStartOperation = vi.hoisted(() => vi.fn())
const mockTrackBillingEvent = vi.hoisted(() => vi.fn())
const mockPermissions = vi.hoisted(() => ({
  value: {
    canManageSubscription: true,
    canDowngradeToPersonal: true
  }
}))
const mockCanDowngradeToPersonal = vi.hoisted(() => ({ value: true }))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    members: mockMembers,
    removeMember: mockRemoveMember,
    fetchMembers: mockFetchMembers
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    startOperation: mockStartOperation
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ permissions: mockPermissions })
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canDowngradeToPersonal: mockCanDowngradeToPersonal
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    subscription: mockSubscription,
    isInitialized: mockIsInitialized,
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: mockUserEmail
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.test'
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: mockTrackBillingEvent
  })
}))

function createMember(
  overrides: Partial<WorkspaceMember> = {}
): WorkspaceMember {
  return {
    id: 'member-1',
    name: 'Member One',
    email: 'member1@example.com',
    joinDate: new Date('2025-01-15'),
    role: 'member',
    isOriginalOwner: false,
    ...overrides
  }
}

function teamWithOwnerAnd(...memberIds: string[]) {
  return [
    createMember({
      id: 'owner',
      role: 'owner',
      email: 'owner@example.com',
      isOriginalOwner: true
    }),
    ...memberIds.map((id) => createMember({ id, email: `${id}@example.com` }))
  ]
}

describe('useDowngradeToPersonal', () => {
  let windowOpen: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockMembers.value = []
    mockUserEmail.value = null
    // Once loaded (isInitialized true), subscription is never null in
    // production — it's at least a FREE-tier record. Default to that
    // loaded-and-active shape; tests that need "not loaded yet" set
    // subscription back to null explicitly alongside isInitialized: false.
    mockSubscription.value = { isCancelled: false }
    mockIsInitialized.value = true
    mockPreviewSubscribe.mockResolvedValue({ allowed: true })
    mockFetchStatus.mockResolvedValue(undefined)
    mockSubscribe.mockResolvedValue({
      billing_op_id: 'op-1',
      status: 'subscribed'
    })
    mockPermissions.value = {
      canManageSubscription: true,
      canDowngradeToPersonal: true
    }
    mockCanDowngradeToPersonal.value = true
    windowOpen = vi.spyOn(window, 'open').mockReturnValue({} as Window)
  })

  afterEach(() => {
    windowOpen.mockRestore()
  })

  describe('removableMembers / hasOtherMembers', () => {
    it('protects only the original owner, removing promoted owners and members', () => {
      mockMembers.value = [
        createMember({ id: 'creator', role: 'owner', isOriginalOwner: true }),
        createMember({
          id: 'promoted-owner',
          role: 'owner',
          isOriginalOwner: false
        }),
        createMember({ id: 'member', role: 'member', isOriginalOwner: false })
      ]
      const { removableMembers, hasOtherMembers } = useDowngradeToPersonal()
      expect(removableMembers.value.map((m) => m.id)).toEqual([
        'promoted-owner',
        'member'
      ])
      expect(hasOtherMembers.value).toBe(true)
    })

    it('reports no other members when only the original owner is present', () => {
      mockMembers.value = teamWithOwnerAnd()
      const { removableMembers, hasOtherMembers } = useDowngradeToPersonal()
      expect(removableMembers.value).toEqual([])
      expect(hasOtherMembers.value).toBe(false)
    })

    it('falls back to protecting owners and the current user when the flag is absent', () => {
      mockUserEmail.value = 'me@example.com'
      mockMembers.value = [
        createMember({
          id: 'owner',
          role: 'owner',
          email: 'owner@example.com',
          isOriginalOwner: false
        }),
        createMember({
          id: 'me',
          role: 'member',
          email: 'me@example.com',
          isOriginalOwner: false
        }),
        createMember({
          id: 'plain',
          role: 'member',
          email: 'plain@example.com',
          isOriginalOwner: false
        })
      ]
      const { removableMembers } = useDowngradeToPersonal()
      expect(removableMembers.value.map((m) => m.id)).toEqual(['plain'])
    })
  })

  describe('downgradeToPersonal', () => {
    it('rejects a promoted owner before previewing or removing members', async () => {
      mockPermissions.value.canDowngradeToPersonal = false
      mockCanDowngradeToPersonal.value = false
      mockMembers.value = teamWithOwnerAnd('m1')
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('rejects a client-side owner when the server denies the downgrade', async () => {
      mockPermissions.value.canDowngradeToPersonal = true
      mockCanDowngradeToPersonal.value = false
      mockMembers.value = teamWithOwnerAnd('m1')
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockPreviewSubscribe).not.toHaveBeenCalled()
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('stops before member removal when downgrade access is revoked during preview', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockImplementation(async () => {
        mockPermissions.value.canDowngradeToPersonal = false
        mockCanDowngradeToPersonal.value = false
        return { allowed: true }
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('stops before submit when downgrade access is revoked during member removal', async () => {
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      mockRemoveMember.mockImplementation(async () => {
        mockPermissions.value.canDowngradeToPersonal = false
        mockCanDowngradeToPersonal.value = false
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockRemoveMember).toHaveBeenCalledOnce()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('removes every non-creator member then initiates the tier change', async () => {
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).toHaveBeenCalledTimes(2)
      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockRemoveMember).toHaveBeenCalledWith('m2')
      expect(mockRemoveMember).not.toHaveBeenCalledWith('owner')
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly', {
        returnUrl: 'https://platform.test/payment/success',
        cancelUrl: 'https://platform.test/payment/failed',
        confirmReactivation: false
      })
    })

    it('removes nobody and never subscribes when the subscription is cancelled and reactivation is not confirmed', async () => {
      mockSubscription.value = { isCancelled: true }
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.reactivationConfirmationRequired'
      )
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('removes members and forwards confirmReactivation once explicitly confirmed with the matching charge', async () => {
      mockSubscription.value = { isCancelled: true }
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade',
        cost_today_cents: 1500
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly', true, 1500)

      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly', {
        returnUrl: 'https://platform.test/payment/success',
        cancelUrl: 'https://platform.test/payment/failed',
        confirmReactivation: true
      })
    })

    it('refuses to bill when the fresh preview cost no longer matches the confirmed charge', async () => {
      // The user consented to $15.00; pricing moved to $20.00 before this
      // fresh preview — billing on the new figure would charge an amount
      // never actually shown to the user.
      mockSubscription.value = { isCancelled: true }
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade',
        cost_today_cents: 2000
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(
        downgradeToPersonal('founder-monthly', true, 1500)
      ).rejects.toThrow('subscription.downgrade.reactivationAmountChanged')
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('refuses to remove members when a status refresh discovers a cancellation the cached read missed', async () => {
      // Mirrors the previewDowngrade race: the subscription looked active at
      // the time of the earlier preview, but was cancelled before this
      // confirm call. The pre-billing status refresh must catch it so
      // members are never removed for a doomed request.
      mockSubscription.value = { isCancelled: false }
      mockFetchStatus.mockImplementation(() => {
        mockSubscription.value = { isCancelled: true }
        return Promise.resolve()
      })
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.reactivationConfirmationRequired'
      )
      expect(mockFetchStatus).toHaveBeenCalled()
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('surfaces a hidden cancellation after member cleanup and forwards the quote timestamp', async () => {
      mockSubscription.value = { isCancelled: false }
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade',
        cost_today_cents: 1500,
        proration_at: '2026-07-30T00:00:00Z'
      })
      mockSubscribe.mockRejectedValueOnce(
        Object.assign(new Error('reactivation confirmation required'), {
          code: 'REACTIVATION_CONFIRMATION_REQUIRED'
        })
      )
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        ReactivationConfirmationRequiredError
      )
      expect(mockSubscribe).toHaveBeenCalledWith(
        'founder-monthly',
        expect.objectContaining({
          confirmReactivation: false,
          prorationAt: '2026-07-30T00:00:00Z'
        })
      )
      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
    })

    it('requires reactivation confirmation when subscription state has not loaded yet', async () => {
      // isInitialized false means "cancelled or not" is unknown; must not
      // default to "not cancelled" and skip disclosure.
      mockIsInitialized.value = false
      mockSubscription.value = null
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.reactivationConfirmationRequired'
      )
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('does not require reactivation confirmation for a brand-new subscription even if cancelled', async () => {
      // A `new_subscription` transition has nothing to reactivate.
      mockSubscription.value = { isCancelled: true }
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'new_subscription'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly', {
        returnUrl: 'https://platform.test/payment/success',
        cancelUrl: 'https://platform.test/payment/failed',
        confirmReactivation: false
      })
    })

    // Regression guard: isInitialized is aggregate (status + balance +
    // plans). A balance/plans failure must not force reactivation onto an
    // otherwise-valid, already-loaded, active subscription.
    it('removes members and subscribes without requiring reactivation when isInitialized is false but subscription status is loaded and active', async () => {
      mockIsInitialized.value = false
      mockSubscription.value = { isCancelled: false }
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly', {
        returnUrl: 'https://platform.test/payment/success',
        cancelUrl: 'https://platform.test/payment/failed',
        confirmReactivation: false
      })
    })

    it('never removes the original owner', async () => {
      mockMembers.value = [
        createMember({ id: 'me', role: 'owner', isOriginalOwner: true })
      ]
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).toHaveBeenCalled()
    })

    it('validates the transition before removing members, then subscribes', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      const calls: string[] = []
      mockPreviewSubscribe.mockImplementation(() => {
        calls.push('preview')
        return Promise.resolve({ allowed: true })
      })
      mockRemoveMember.mockImplementation(() => {
        calls.push('remove')
        return Promise.resolve()
      })
      mockTrackBillingEvent.mockImplementation((event) => {
        if (
          event.stage === 'started' &&
          (event.operation === 'subscription_checkout' ||
            event.operation === 'operation')
        ) {
          calls.push(`${event.operation}-start`)
        }
      })
      mockSubscribe.mockImplementation(() => {
        calls.push('subscribe')
        return Promise.resolve({ billing_op_id: 'op-1', status: 'subscribed' })
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(calls).toEqual([
        'preview',
        'remove',
        'subscription_checkout-start',
        'operation-start',
        'subscribe'
      ])
    })

    it('returns the preview and subscribe response', async () => {
      const preview = {
        allowed: true,
        transition_type: 'downgrade' as const,
        effective_at: '2099-02-20T00:00:00Z',
        is_immediate: false,
        cost_today_cents: 0,
        cost_next_period_cents: 33_600,
        credits_today_cents: 0,
        credits_next_period_cents: 7_400,
        new_plan: {
          slug: 'creator-annual',
          tier: 'CREATOR' as const,
          duration: 'ANNUAL' as const,
          price_cents: 33_600,
          credits_cents: 7_400,
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 33_600,
            total_credits_cents: 7_400
          }
        }
      }
      const response = {
        billing_op_id: 'existing-downgrade',
        status: 'subscribed' as const
      }
      mockPreviewSubscribe.mockResolvedValue(preview)
      mockSubscribe.mockResolvedValue(response)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      const result = await downgradeToPersonal('creator-annual')

      expect(result).toStrictEqual({ preview, response })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: 0,
        member_removal_failures: 0,
        target_tier: 'creator',
        duration_ms: expect.any(Number)
      })
    })

    it('throws the BE reason and removes nobody when the transition is disallowed', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({
        allowed: false,
        reason: 'Outstanding balance'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'Outstanding balance'
      )
      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('opens the payment-method page and polls when subscribe needs a payment method', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue({
        billing_op_id: 'op-2',
        status: 'needs_payment_method',
        payment_method_url: 'https://pay.test/method'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(windowOpen).toHaveBeenCalledWith(
        'https://pay.test/method',
        '_blank'
      )
      expect(mockStartOperation).toHaveBeenCalledWith('op-2', 'subscription', {
        tier: undefined,
        cycle: undefined,
        checkoutType: 'change',
        downgradeToPersonal: {
          memberRemovalCount: 1,
          memberRemovalFailures: 0,
          targetTier: undefined,
          startedAt: expect.any(Number)
        },
        attemptStartedAt: expect.any(Number)
      })
    })

    it('falls back to the generic message when the transition is disallowed without a reason', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockResolvedValue({ allowed: false })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
    })

    it('throws and skips polling when the payment tab is popup-blocked', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue({
        billing_op_id: 'op-5',
        status: 'needs_payment_method',
        payment_method_url: 'https://pay.test/method'
      })
      windowOpen.mockReturnValue(null)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.paymentPageBlocked'
      )
      expect(mockStartOperation).not.toHaveBeenCalled()
    })

    it('throws when a payment method is needed but no url is provided', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue({
        billing_op_id: 'op-3',
        status: 'needs_payment_method'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.paymentMethodRequired'
      )
      expect(mockStartOperation).not.toHaveBeenCalled()
    })

    it('polls without opening a tab when the payment is pending', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue({
        billing_op_id: 'op-4',
        status: 'pending_payment'
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(windowOpen).not.toHaveBeenCalled()
      expect(mockStartOperation).toHaveBeenCalledWith('op-4', 'subscription', {
        tier: undefined,
        cycle: undefined,
        checkoutType: 'change',
        downgradeToPersonal: {
          memberRemovalCount: 1,
          memberRemovalFailures: 0,
          targetTier: undefined,
          startedAt: expect.any(Number)
        },
        attemptStartedAt: expect.any(Number)
      })
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'succeeded' })
      )
    })

    it('reports the generic failure when subscribe fails and no members were removed', async () => {
      mockMembers.value = teamWithOwnerAnd()
      mockSubscribe.mockResolvedValue(undefined)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        /^subscription\.downgrade\.failed$/
      )
    })

    it('reports members were already removed when subscribe returns no response', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue(undefined)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.failedAfterMemberRemoval'
      )
      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
    })

    it('surfaces which member failed and skips the plan change', async () => {
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      mockRemoveMember.mockImplementation((id: string) =>
        id === 'm2' ? Promise.reject(new Error('network')) : Promise.resolve()
      )
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'm2@example.com'
      )
      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockSubscribe).not.toHaveBeenCalled()
    })
  })

  describe('downgradeToPersonal telemetry', () => {
    it('tracks the start of the downgrade with the pending removal count', async () => {
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'started',
        outcome: 'pending',
        member_removal_count: 2,
        member_removal_failures: 0
      })
    })

    it('tracks a failed outcome without the member email', async () => {
      mockMembers.value = teamWithOwnerAnd('m1', 'm2')
      mockRemoveMember.mockImplementation((id: string) =>
        id === 'm2' ? Promise.reject(new Error('network')) : Promise.resolve()
      )
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'm2@example.com'
      )

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: 2,
        member_removal_failures: 1,
        target_tier: undefined,
        failure_category: 'unknown',
        error_code: 'member_removal_failed',
        duration_ms: expect.any(Number)
      })
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'succeeded' })
      )
    })

    it('uses a bounded unknown category when a non-Error value is thrown', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockRejectedValue('boom')
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toBe('boom')

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: 1,
        member_removal_failures: 0,
        target_tier: undefined,
        failure_category: 'unknown',
        duration_ms: expect.any(Number)
      })
    })

    it('categorizes an uncaught previewSubscribe failure via the shared classifier', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockRejectedValue(
        new WorkspaceApiError('offline', 502)
      )
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'offline'
      )

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: 1,
        member_removal_failures: 0,
        target_tier: undefined,
        failure_category: 'api_rejected',
        duration_ms: expect.any(Number)
      })
    })

    it('categorizes a status-less previewSubscribe failure as network', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockPreviewSubscribe.mockRejectedValue(new WorkspaceApiError('offline'))
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'offline'
      )

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: 1,
        member_removal_failures: 0,
        target_tier: undefined,
        failure_category: 'network',
        duration_ms: expect.any(Number)
      })
    })

    it('categorizes a member-removal failure via the shared classifier', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockRemoveMember.mockRejectedValue(new WorkspaceApiError('rejected', 400))
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'm1@example.com'
      )

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: 1,
        member_removal_failures: 1,
        target_tier: undefined,
        failure_category: 'api_rejected',
        error_code: 'member_removal_failed',
        duration_ms: expect.any(Number)
      })
    })
  })

  describe('previewDowngrade', () => {
    it('reports requiresReactivationConfirmation for a cancelled subscription changing plans', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade',
        cost_today_cents: 0
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      const result = await previewDowngrade('founder-monthly')

      expect(result.requiresReactivationConfirmation).toBe(true)
      expect(mockRemoveMember).not.toHaveBeenCalled()
    })

    it('reports no reactivation requirement when the subscription is known and not cancelled', async () => {
      mockSubscription.value = { isCancelled: false }
      mockIsInitialized.value = true
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      const result = await previewDowngrade('founder-monthly')

      expect(result.requiresReactivationConfirmation).toBe(false)
    })

    // Regression guard: isInitialized only becomes true once status, balance,
    // AND plans have all loaded — a balance/plans failure must not force
    // reactivation onto an otherwise-valid, already-loaded, active
    // subscription. Gate on status readiness (subscription !== null) instead.
    it('reports no reactivation requirement when isInitialized is false but subscription status is loaded and active', async () => {
      mockSubscription.value = { isCancelled: false }
      mockIsInitialized.value = false
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      const result = await previewDowngrade('founder-monthly')

      expect(result.requiresReactivationConfirmation).toBe(false)
    })

    it('requires reactivation confirmation when subscription state has not loaded, even with no cached subscription', async () => {
      mockSubscription.value = null
      mockIsInitialized.value = false
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      const result = await previewDowngrade('founder-monthly')

      expect(result.requiresReactivationConfirmation).toBe(true)
    })

    it('throws the BE reason without removing members when the transition is disallowed', async () => {
      mockSubscription.value = { isCancelled: true }
      mockPreviewSubscribe.mockResolvedValue({
        allowed: false,
        reason: 'Outstanding balance'
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      await expect(previewDowngrade('founder-monthly')).rejects.toThrow(
        'Outstanding balance'
      )
    })

    it('reports the cancellation discovered by refreshing status, not the stale cached read', async () => {
      // The cached subscription (loaded earlier) still says "not cancelled";
      // the status refresh this call triggers is what discovers the
      // cancellation, so the decision must reflect the refreshed value.
      mockSubscription.value = { isCancelled: false }
      mockFetchStatus.mockImplementation(() => {
        mockSubscription.value = { isCancelled: true }
        return Promise.resolve()
      })
      mockPreviewSubscribe.mockResolvedValue({
        allowed: true,
        transition_type: 'downgrade'
      })
      const { previewDowngrade } = useDowngradeToPersonal()

      const result = await previewDowngrade('founder-monthly')

      expect(mockFetchStatus).toHaveBeenCalled()
      expect(result.requiresReactivationConfirmation).toBe(true)
    })
  })

  describe('refreshMembers', () => {
    it('refetches members so a stale empty list cannot skip the confirm gate', async () => {
      mockMembers.value = []
      mockFetchMembers.mockImplementation(() => {
        mockMembers.value = teamWithOwnerAnd('m1')
        return Promise.resolve(mockMembers.value)
      })
      const { refreshMembers, hasOtherMembers } = useDowngradeToPersonal()
      expect(hasOtherMembers.value).toBe(false)

      await refreshMembers()

      expect(hasOtherMembers.value).toBe(true)
    })

    it('rejects a member without fetching workspace members', async () => {
      mockPermissions.value = {
        canManageSubscription: false,
        canDowngradeToPersonal: false
      }
      mockCanDowngradeToPersonal.value = false
      const { refreshMembers } = useDowngradeToPersonal()

      await expect(refreshMembers()).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockFetchMembers).not.toHaveBeenCalled()
    })

    it('rejects a promoted owner after refreshing the original-owner signal', async () => {
      mockPermissions.value.canDowngradeToPersonal = false
      mockCanDowngradeToPersonal.value = false
      const { refreshMembers } = useDowngradeToPersonal()

      await expect(refreshMembers()).rejects.toThrow(
        'subscription.downgrade.notAllowed'
      )
      expect(mockFetchMembers).toHaveBeenCalledOnce()
    })
  })
})
