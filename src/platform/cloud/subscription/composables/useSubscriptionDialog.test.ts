import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  BillingSubscriptionStatus,
  TeamCreditStops,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'
import {
  getPendingSubscriptionCheckout,
  savePendingSubscriptionCheckout
} from '@/platform/workspace/utils/pendingSubscriptionCheckout'

import { useSubscriptionDialog } from './useSubscriptionDialog'

const mockCloseDialog = vi.fn()
const mockShowLayoutDialog = vi.fn()
const mockShowTeamWorkspacesDialog = vi.fn()
const mockTrackSubscription = vi.hoisted(() => vi.fn())
const mockIsInPersonalWorkspace = vi.hoisted(() => ({ value: true }))
const mockIsFreeTier = vi.hoisted(() => ({ value: false }))
const mockTier = vi.hoisted(() => ({ value: 'FREE' as string | null }))
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))
const mockShouldUseUnifiedPricing = vi.hoisted(() => ({
  value: null as boolean | null
}))
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockIsLegacyTeamPlan = vi.hoisted(() => ({ value: false }))
const mockIsTeamPlan = vi.hoisted(() => ({ value: false }))
const mockCurrentPlanSlug = vi.hoisted(() => ({ value: null as string | null }))
const mockCanManageSubscription = vi.hoisted(() => ({ value: true }))
const mockEmbeddedCheckoutEnabled = vi.hoisted(() => ({ value: false }))
const mockActiveWorkspaceId = vi.hoisted(() => ({ value: 'workspace-1' }))
const mockUserId = vi.hoisted(() => ({ value: 'user-1' as string | undefined }))
const mockStartOperation = vi.hoisted(() => vi.fn())
const mockFetchPlans = vi.hoisted(() => vi.fn())
const mockFetchStatus = vi.hoisted(() => vi.fn())
const mockTeamCreditStops = vi.hoisted(() => ({
  value: null as TeamCreditStops | null
}))
const mockCurrentTeamCreditStop = vi.hoisted(() => ({
  value: null as TeamCreditStopSummary | null
}))
const mockSubscription = vi.hoisted(() => ({
  value: null as Pick<SubscriptionInfo, 'duration'> | null
}))
const mockSubscriptionStatus = vi.hoisted(() => ({
  value: null as BillingSubscriptionStatus | null
}))

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    defineAsyncComponent: vi.fn((loader) => loader)
  }
})

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLayoutDialog: mockShowLayoutDialog,
    showTeamWorkspacesDialog: mockShowTeamWorkspacesDialog
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    get shouldUseWorkspaceBilling() {
      return mockShouldUseWorkspaceBilling
    },
    get shouldUseUnifiedPricing() {
      return {
        value:
          mockShouldUseUnifiedPricing.value ??
          mockShouldUseWorkspaceBilling.value
      }
    }
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get embeddedCheckoutEnabled() {
        return mockEmbeddedCheckoutEnabled.value
      }
    }
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mockActiveWorkspaceId.value
    },
    get isInPersonalWorkspace() {
      return mockIsInPersonalWorkspace.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({ startOperation: mockStartOperation })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get userId() {
      return mockUserId.value
    }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isFreeTier: mockIsFreeTier,
    isLegacyTeamPlan: mockIsLegacyTeamPlan,
    isTeamPlan: mockIsTeamPlan,
    currentPlanSlug: mockCurrentPlanSlug,
    tier: mockTier,
    fetchPlans: mockFetchPlans,
    fetchStatus: mockFetchStatus,
    teamCreditStops: mockTeamCreditStops,
    currentTeamCreditStop: mockCurrentTeamCreditStop,
    subscription: mockSubscription,
    subscriptionStatus: mockSubscriptionStatus
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackSubscription: mockTrackSubscription })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return { canManageSubscription: mockCanManageSubscription.value }
      }
    }
  })
}))

function expectRekaPricingDialogProps(
  dialogComponentProps: Record<string, unknown>
) {
  expect(dialogComponentProps).toMatchObject({
    renderer: 'reka',
    size: 'full',
    dismissableMask: false
  })
  expect(dialogComponentProps).not.toHaveProperty('style')
  expect(dialogComponentProps).not.toHaveProperty('pt')
}

describe('useSubscriptionDialog', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockIsInPersonalWorkspace.value = true
    mockIsFreeTier.value = false
    mockTier.value = 'FREE'
    mockShouldUseWorkspaceBilling.value = false
    mockShouldUseUnifiedPricing.value = null
    mockIsLegacyTeamPlan.value = false
    mockIsTeamPlan.value = false
    mockCurrentPlanSlug.value = null
    mockCanManageSubscription.value = true
    mockEmbeddedCheckoutEnabled.value = false
    mockActiveWorkspaceId.value = 'workspace-1'
    mockUserId.value = 'user-1'
    mockStartOperation.mockResolvedValue({ status: 'succeeded' })
    mockFetchPlans.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
    mockTeamCreditStops.value = null
    mockCurrentTeamCreditStop.value = null
    mockSubscription.value = null
    mockSubscriptionStatus.value = null
    sessionStorage.clear()
  })

  describe('showPricingTable', () => {
    it('does not open dialog on non-cloud', () => {
      mockIsCloud.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('opens dialog on cloud', () => {
      mockIsCloud.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockShowLayoutDialog).toHaveBeenCalled()
    })

    it('does not wire onChooseTeam on the unified table (personal subscribes directly)', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).not.toHaveProperty('onChooseTeam')
    })

    it('sizes the unified pricing dialog via the Reka contentClass, not the ignored PrimeVue style', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const { dialogComponentProps } = mockShowLayoutDialog.mock.calls[0][0]
      expectRekaPricingDialogProps(dialogComponentProps)
    })

    it('defaults to the personal tab in a personal workspace', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
    })

    it('opens the team tab when planMode is forced from a personal workspace', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      mockCurrentPlanSlug.value = 'creator-monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ planMode: 'team' })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('passes a deep-linked checkout selection to the unified dialog', () => {
      mockShouldUseWorkspaceBilling.value = true
      const { showPricingTable } = useSubscriptionDialog()
      const initialCheckout = {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      } as const

      showPricingTable({ planMode: 'personal', initialCheckout })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialCheckout).toEqual(initialCheckout)
    })

    it('routes a personal deep link through the legacy Team downgrade flow', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = true
      const { showPricingTable } = useSubscriptionDialog()
      const initialCheckout = {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      } as const

      showPricingTable({ initialCheckout })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).toMatchObject({ isPersonal: true, initialCheckout })
    })

    it('keeps a Team stop deep link table-only for a legacy Team plan', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({
        initialCheckout: {
          planMode: 'team',
          stop: {
            id: 'team_700',
            credits: 147_700,
            usd: 700,
            discountedUsd: 630
          },
          billingCycle: 'yearly'
        }
      })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).not.toHaveProperty('initialCheckout')
      expect(props).not.toHaveProperty('isPersonal')
    })

    it('defaults to the team tab for a Team plan in a personal workspace', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      mockIsTeamPlan.value = true
      mockCurrentPlanSlug.value = 'team_per_credit_monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('defaults to the personal tab for a personal plan in a team workspace', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockCurrentPlanSlug.value = 'creator-monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
    })

    it('keeps personal checkout deep links table-only on the legacy billing flow', () => {
      mockShouldUseWorkspaceBilling.value = false
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({
        reason: 'deep_link',
        initialCheckout: {
          planMode: 'personal',
          tierKey: 'creator',
          billingCycle: 'monthly'
        }
      })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).toHaveProperty('onChooseTeam')
      expect(props).not.toHaveProperty('initialCheckout')
      const { dialogComponentProps } = mockShowLayoutDialog.mock.calls[0][0]
      expectRekaPricingDialogProps(dialogComponentProps)
      expect(mockTrackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        expect.objectContaining({ reason: 'deep_link' })
      )
    })

    it('uses the unified table when pricing is unified but billing remains legacy', () => {
      mockShouldUseWorkspaceBilling.value = false
      mockShouldUseUnifiedPricing.value = true
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
      expect(props).not.toHaveProperty('onChooseTeam')
      expect(props.embeddedCheckoutEnabled).toBe(false)
    })

    it('enables embedded checkout only for the exact server flag', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockEmbeddedCheckoutEnabled.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(
        mockShowLayoutDialog.mock.calls[0][0].props.embeddedCheckoutEnabled
      ).toBe(true)
    })

    it('routes an existing per-member (legacy) team subscriber to the old team table', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      // The legacy team dialog takes onClose + reason and none of the unified
      // props. `reason` separates it from the read-only member dialog (onClose
      // only); the absent initialPlanMode separates it from the unified table.
      expect(props).toHaveProperty('reason')
      expect(props).not.toHaveProperty('initialPlanMode')
      expect(props).not.toHaveProperty('onChooseTeam')
    })

    it('sizes the legacy workspace pricing dialog via Reka contentClass', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const { dialogComponentProps } = mockShowLayoutDialog.mock.calls[0][0]
      expect(dialogComponentProps).toMatchObject({
        modal: false
      })
      expectRekaPricingDialogProps(dialogComponentProps)
    })

    it('defaults an unsubscribed team workspace to the team tab', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('shows the read-only member dialog in a personal workspace', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = true
      mockCanManageSubscription.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).toHaveProperty('onClose')
      expect(props).not.toHaveProperty('reason')
      expect(props).not.toHaveProperty('initialPlanMode')
    })

    it('tracks modal_opened with the caller reason and current tier', () => {
      mockTier.value = 'STANDARD'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'upgrade_to_add_credits' })

      expect(mockTrackSubscription).toHaveBeenCalledWith('modal_opened', {
        current_tier: 'standard',
        reason: 'upgrade_to_add_credits'
      })
    })

    it('tracks modal_opened on the workspace (unified) path too', () => {
      mockShouldUseWorkspaceBilling.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockTrackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        expect.objectContaining({ reason: 'subscribe_to_run' })
      )
    })

    it('does not track modal_opened for the inactive member dialog', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockCanManageSubscription.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      expect(mockTrackSubscription).not.toHaveBeenCalled()
    })

    it('shows the read-only member dialog for out-of-credits too, not the pricing table', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockCanManageSubscription.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'out_of_credits' })

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).toHaveProperty('onClose')
      expect(props).not.toHaveProperty('reason')
      expect(props).not.toHaveProperty('initialPlanMode')
    })

    it('does not track on non-cloud', () => {
      mockIsCloud.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockTrackSubscription).not.toHaveBeenCalled()
    })
  })

  describe('show', () => {
    it('sends a free-tier personal user straight to the pricing table', () => {
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = true
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('checks workspace member permission before the personal free-tier path', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = true
      mockCanManageSubscription.value = false
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
      expect(mockTrackSubscription).not.toHaveBeenCalled()
    })

    it('falls back to the pricing table for a non-free-tier user', () => {
      mockIsFreeTier.value = false
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('falls back to the pricing table for a free-tier team workspace', () => {
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = false
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('tracks modal_opened with the reason for the free-tier dialog', () => {
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = true
      const { show } = useSubscriptionDialog()

      show({ reason: 'out_of_credits' })

      expect(mockTrackSubscription).toHaveBeenCalledTimes(1)
      expect(mockTrackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        expect.objectContaining({ reason: 'out_of_credits' })
      )
    })
  })

  describe('startTeamWorkspaceUpgradeFlow', () => {
    it('closes existing dialogs before opening team workspace dialog', () => {
      mockShowTeamWorkspacesDialog.mockResolvedValue(undefined)
      const { startTeamWorkspaceUpgradeFlow } = useSubscriptionDialog()

      startTeamWorkspaceUpgradeFlow()

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'subscription-required'
      })
      expect(mockShowTeamWorkspacesDialog).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('persists resume intent to sessionStorage via onConfirm callback', () => {
      mockShowTeamWorkspacesDialog.mockResolvedValue(undefined)
      const { startTeamWorkspaceUpgradeFlow } = useSubscriptionDialog()

      startTeamWorkspaceUpgradeFlow()

      const onConfirm = mockShowTeamWorkspacesDialog.mock.calls[0][0]
      onConfirm()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBe('1')
    })

    it('reopens pricing table on dialog rejection', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockShowTeamWorkspacesDialog.mockRejectedValue(new Error('dialog error'))

      const { startTeamWorkspaceUpgradeFlow } = useSubscriptionDialog()
      startTeamWorkspaceUpgradeFlow()

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[useSubscriptionDialog] Failed to open team workspaces dialog:',
          expect.any(Error)
        )
      })

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('resumePendingPricingFlow', () => {
    it('does nothing when no resume intent is stored', () => {
      const { resumePendingPricingFlow } = useSubscriptionDialog()

      void resumePendingPricingFlow()

      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('shows pricing table and clears intent when in team workspace', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = false
      mockShouldUseWorkspaceBilling.value = true
      mockCurrentPlanSlug.value = 'creator-monthly'

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      void resumePendingPricingFlow()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBeNull()
      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'subscription-required',
          props: expect.objectContaining({ initialPlanMode: 'team' })
        })
      )
    })

    it('clears intent but does not show pricing if still in personal workspace', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = true

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      void resumePendingPricingFlow()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBeNull()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('consumes intent so second call is a no-op', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = false

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      void resumePendingPricingFlow()
      mockShowLayoutDialog.mockClear()

      void resumePendingPricingFlow()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('reconciles a failed redirect and reopens the attempted checkout', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockStartOperation.mockResolvedValueOnce({ status: 'failed' })
      savePendingSubscriptionCheckout({
        operationId: 'op-alipay',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'personal',
          tierKey: 'creator',
          billingCycle: 'monthly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockStartOperation).toHaveBeenCalledWith(
        'op-alipay',
        'subscription',
        {
          tier: 'creator',
          cycle: 'monthly',
          attemptStartedAt: expect.any(Number)
        }
      )
      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialPlanMode: 'personal',
            initialCheckout: {
              planMode: 'personal',
              tierKey: 'creator',
              billingCycle: 'monthly'
            }
          })
        })
      )
      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('completes a succeeded redirect silently', async () => {
      mockShouldUseWorkspaceBilling.value = true
      savePendingSubscriptionCheckout({
        operationId: 'op-succeeded',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'personal',
          tierKey: 'creator',
          billingCycle: 'monthly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockStartOperation).toHaveBeenCalledOnce()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('does not reopen checkout when reconciliation times out', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockStartOperation.mockResolvedValueOnce({ status: 'timeout' })
      savePendingSubscriptionCheckout({
        operationId: 'op-timeout',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'personal',
          tierKey: 'creator',
          billingCycle: 'monthly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
      // A poll giving up says nothing about the server-side operation, which
      // can stay pending for hours awaiting bank authentication.
      expect(getPendingSubscriptionCheckout()?.operationId).toBe('op-timeout')
    })

    it('keeps the pointer for an unfinished operation across repeated resumes', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockStartOperation.mockResolvedValue({ status: 'pending' })
      savePendingSubscriptionCheckout({
        operationId: 'op-parked',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'personal',
          tierKey: 'creator',
          billingCycle: 'monthly'
        },
        attemptedAt: Date.now()
      })

      await useSubscriptionDialog().resumePendingPricingFlow()
      expect(getPendingSubscriptionCheckout()?.operationId).toBe('op-parked')

      await useSubscriptionDialog().resumePendingPricingFlow()
      expect(getPendingSubscriptionCheckout()?.operationId).toBe('op-parked')

      expect(mockStartOperation).toHaveBeenCalledTimes(2)
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('clears a checkout owned by another user without reconciling it', async () => {
      savePendingSubscriptionCheckout({
        operationId: 'op-other-user',
        workspaceId: 'workspace-1',
        ownerUid: 'user-2',
        selection: {
          planMode: 'personal',
          tierKey: 'standard',
          billingCycle: 'yearly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockStartOperation).not.toHaveBeenCalled()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('clears a checkout for another workspace without reconciling it', async () => {
      savePendingSubscriptionCheckout({
        operationId: 'op-other-workspace',
        workspaceId: 'workspace-2',
        ownerUid: 'user-1',
        selection: {
          planMode: 'personal',
          tierKey: 'standard',
          billingCycle: 'yearly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockStartOperation).not.toHaveBeenCalled()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
    })

    it('restores a Team plan change from fresh catalog and subscription state', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockStartOperation.mockResolvedValueOnce({ status: 'failed' })
      mockFetchPlans.mockImplementationOnce(async () => {
        mockTeamCreditStops.value = {
          default_stop_index: 0,
          stops: [
            {
              id: 'team_700',
              credits: 147_700,
              monthly: {
                list_price_cents: 70_000,
                price_cents: 66_500
              },
              yearly: {
                list_price_cents: 70_000,
                price_cents: 63_000
              }
            }
          ]
        }
      })
      mockFetchStatus.mockImplementationOnce(async () => {
        mockCurrentTeamCreditStop.value = {
          id: 'team_400',
          stop_usd: 400,
          credits_monthly: 84_400
        }
        mockSubscription.value = { duration: 'MONTHLY' }
        mockSubscriptionStatus.value = 'active'
      })
      savePendingSubscriptionCheckout({
        operationId: 'op-team-change',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'team',
          teamCreditStopId: 'team_700',
          billingCycle: 'yearly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCheckout: {
              planMode: 'team',
              stop: {
                id: 'team_700',
                credits: 147_700,
                usd: 700,
                discountedUsd: 630
              },
              billingCycle: 'yearly',
              isChange: true
            }
          })
        })
      )
    })

    it('falls back to Team pricing when the stop catalog is unavailable', async () => {
      mockShouldUseWorkspaceBilling.value = true
      mockStartOperation.mockResolvedValueOnce({ status: 'failed' })
      savePendingSubscriptionCheckout({
        operationId: 'op-team-catalog-failure',
        workspaceId: 'workspace-1',
        ownerUid: 'user-1',
        selection: {
          planMode: 'team',
          teamCreditStopId: 'team_700',
          billingCycle: 'yearly'
        },
        attemptedAt: Date.now()
      })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      await resumePendingPricingFlow()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ initialPlanMode: 'team' })
        })
      )
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialCheckout).toBeUndefined()
    })
  })
})
