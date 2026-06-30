import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDowngradeToPersonal } from './useDowngradeToPersonal'

const mockMembers = ref<WorkspaceMember[]>([])
const mockUserEmail = ref<string | null>(null)
const mockRemoveMember = vi.hoisted(() => vi.fn())
const mockFetchMembers = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn())
const mockPreviewSubscribe = vi.hoisted(() => vi.fn())
const mockStartOperation = vi.hoisted(() => vi.fn())

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

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe
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
    vi.resetAllMocks()
    mockMembers.value = []
    mockUserEmail.value = null
    mockPreviewSubscribe.mockResolvedValue({ allowed: true })
    mockSubscribe.mockResolvedValue({
      billing_op_id: 'op-1',
      status: 'subscribed'
    })
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
        cancelUrl: 'https://platform.test/payment/failed'
      })
      expect(mockStartOperation).not.toHaveBeenCalled()
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

    it('validates the transition before removing, then removes, then subscribes', async () => {
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
      mockSubscribe.mockImplementation(() => {
        calls.push('subscribe')
        return Promise.resolve({ billing_op_id: 'op-1', status: 'subscribed' })
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(calls).toEqual(['preview', 'remove', 'subscribe'])
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
      expect(mockStartOperation).toHaveBeenCalledWith('op-2', 'subscription')
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
      expect(mockStartOperation).toHaveBeenCalledWith('op-4', 'subscription')
    })

    it('reports the generic failure when subscribe fails and no members were removed', async () => {
      mockMembers.value = teamWithOwnerAnd()
      mockSubscribe.mockResolvedValue(undefined)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        /^subscription\.downgrade\.failed$/
      )
    })

    it('reports members were already removed when subscribe fails after removal', async () => {
      mockMembers.value = teamWithOwnerAnd('m1')
      mockSubscribe.mockResolvedValue(undefined)
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await expect(downgradeToPersonal('founder-monthly')).rejects.toThrow(
        'subscription.downgrade.failedAfterMemberRemoval'
      )
    })

    it('surfaces which member failed and skips the plan change when removal throws', async () => {
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
  })
})
