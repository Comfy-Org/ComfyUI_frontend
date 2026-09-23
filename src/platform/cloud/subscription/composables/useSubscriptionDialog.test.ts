import { useDialogStore } from '@/stores/dialogStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { BillingOperationRecordView } from '@/platform/workspace/billing/sdk/operationRecordView'
import { fakeBillingSdk } from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useAuthStore } from '@/stores/authStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useDialogService } from '@/services/dialogService'
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

const mockIsFreeTier = vi.hoisted(() => ({ value: false }))
const mockTier = vi.hoisted(() => ({ value: 'FREE' as string | null }))
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockIsLegacyTeamPlan = vi.hoisted(() => ({ value: false }))
const mockIsTeamPlan = vi.hoisted(() => ({ value: false }))
const mockCurrentPlanSlug = vi.hoisted(() => ({ value: null as string | null }))
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

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/composables/useFeatureFlags'))
// The store is real; only the composition root it builds is faked, so the
// testing Pinia still owns the store and its actions.
const mockCreateBillingSdk = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

/** A settled operation as the SDK store projects it for a recovery caller. */
function recoveredOperation(
  status: BillingOperationRecordView['status']
): BillingOperationRecordView {
  return {
    opId: 'op-parked',
    kind: 'subscription',
    workspaceId: 'workspace-1',
    status,
    actionUrl: null,
    phase: null,
    authenticationState: null,
    isAuthenticating: false,
    canRetryAuthentication: false,
    errorMessage: null
  }
}

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

beforeEach(() => {
  vi.mocked(useDialogService().showLayoutDialog).mockImplementation(
    mockShowLayoutDialog
  )
  vi.mocked(useDialogService().showTeamWorkspacesDialog).mockImplementation(
    mockShowTeamWorkspacesDialog
  )
  const billing = useBillingContext()
  Object.assign(billing, {
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
  vi.mocked(useBillingContext).mockReturnValue(billing)
  Object.assign(useAuthStore(), { userId: 'user-1' })
  vi.mocked(useDialogStore().closeDialog).mockImplementation(mockCloseDialog)

  vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
    mockStartOperation
  )
  mockCreateBillingSdk.mockReturnValue(fakeBillingSdk().sdk)
})

describe('useSubscriptionDialog', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
    mockIsFreeTier.value = false
    mockTier.value = 'FREE'
    mockIsLegacyTeamPlan.value = false
    mockIsTeamPlan.value = false
    mockCurrentPlanSlug.value = null
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    Object.assign(useAuthStore(), { userId: 'user-1' })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).not.toHaveProperty('onChooseTeam')
    })

    it('sizes the unified pricing dialog via the Reka contentClass, not the ignored PrimeVue style', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const { dialogComponentProps } = mockShowLayoutDialog.mock.calls[0][0]
      expectRekaPricingDialogProps(dialogComponentProps)
    })

    it('defaults to the personal tab in a personal workspace', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
    })

    it('opens the team tab when planMode is forced from a personal workspace', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      mockCurrentPlanSlug.value = 'creator-monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ planMode: 'team' })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('passes a deep-linked checkout selection to the unified dialog', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      mockIsTeamPlan.value = true
      mockCurrentPlanSlug.value = 'team_per_credit_monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('defaults to the personal tab for a personal plan in a team workspace', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      mockCurrentPlanSlug.value = 'creator-monthly'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
    })

    it('keeps personal checkout deep links table-only on the legacy billing flow', () => {
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
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
      expect(useTelemetry()?.trackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        expect.objectContaining({ reason: 'deep_link' })
      )
    })

    it('uses the unified table when pricing is unified but billing remains legacy', () => {
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('personal')
      expect(props).not.toHaveProperty('onChooseTeam')
      expect(props.embeddedCheckoutEnabled).toBe(false)
    })

    it('enables embedded checkout only for the exact server flag', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(
        mockShowLayoutDialog.mock.calls[0][0].props.embeddedCheckoutEnabled
      ).toBe(true)
    })

    it('routes an existing per-member (legacy) team subscriber to the old team table', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      mockIsLegacyTeamPlan.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('shows the read-only member dialog in a personal workspace', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      useWorkspaceUI().permissions.value.canManageSubscription = false
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

      expect(useTelemetry()?.trackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        {
          current_tier: 'standard',
          reason: 'upgrade_to_add_credits'
        }
      )
    })

    it('tracks modal_opened on the workspace (unified) path too', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(useTelemetry()?.trackSubscription).toHaveBeenCalledWith(
        'modal_opened',
        expect.objectContaining({ reason: 'subscribe_to_run' })
      )
    })

    it('does not track modal_opened for the inactive member dialog', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      useWorkspaceUI().permissions.value.canManageSubscription = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackSubscription).not.toHaveBeenCalled()
    })

    it('shows the read-only member dialog for out-of-credits too, not the pricing table', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      useWorkspaceUI().permissions.value.canManageSubscription = false
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

      expect(useTelemetry()?.trackSubscription).not.toHaveBeenCalled()
    })
  })

  describe('show', () => {
    it('sends a free-tier personal user straight to the pricing table', () => {
      mockIsFreeTier.value = true
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('checks workspace member permission before the personal free-tier path', () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      mockIsFreeTier.value = true
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      useWorkspaceUI().permissions.value.canManageSubscription = false
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
      expect(useTelemetry()?.trackSubscription).not.toHaveBeenCalled()
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
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('tracks modal_opened with the reason for the free-tier dialog', () => {
      mockIsFreeTier.value = true
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
      const { show } = useSubscriptionDialog()

      show({ reason: 'out_of_credits' })

      expect(useTelemetry()?.trackSubscription).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackSubscription).toHaveBeenCalledWith(
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
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      void resumePendingPricingFlow()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBeNull()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('consumes intent so second call is a no-op', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      void resumePendingPricingFlow()
      mockShowLayoutDialog.mockClear()

      void resumePendingPricingFlow()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('reconciles a failed redirect and reopens the attempted checkout', async () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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

    // One behaviour, two entry points: a pending checkout is adopted by
    // whichever rail owns the operation. Half-railed recovery is the ambiguity
    // FE-2484 and FE-2483 exist together to remove.
    it.for([
      { rail: 'SDK', railEnabled: true },
      { rail: 'legacy', railEnabled: false }
    ])(
      'resumes a parked checkout on the $rail rail and reopens it on failure',
      async ({ railEnabled }) => {
        const recoverPendingOperationSpy = vi.mocked(
          useBillingSdkStore().recoverPendingOperation
        )
        vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled =
          railEnabled
        useBillingRouting().type = computed(() => 'workspace')
        useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
        useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
        mockStartOperation.mockResolvedValueOnce({ status: 'failed' })
        recoverPendingOperationSpy.mockResolvedValueOnce(
          recoveredOperation('failed')
        )
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

        const { resumePendingPricingFlow } = useSubscriptionDialog()
        await resumePendingPricingFlow()

        expect(recoverPendingOperationSpy).toHaveBeenCalledTimes(
          railEnabled ? 1 : 0
        )
        expect(mockStartOperation).toHaveBeenCalledTimes(railEnabled ? 0 : 1)
        if (railEnabled) {
          expect(recoverPendingOperationSpy).toHaveBeenCalledWith('op-parked')
        }
        // Whichever rail adopted it, the host pointer still restores the
        // tier/cycle the pricing dialog reopens on.
        expect(mockShowLayoutDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({
              initialCheckout: {
                planMode: 'personal',
                tierKey: 'creator',
                billingCycle: 'monthly'
              }
            })
          })
        )
      }
    )

    it('drops a stale pointer the SDK rail finds nothing to adopt for', async () => {
      const recoverPendingOperationSpy = vi.mocked(
        useBillingSdkStore().recoverPendingOperation
      )
      vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled =
        true
      recoverPendingOperationSpy.mockResolvedValueOnce(undefined)
      savePendingSubscriptionCheckout({
        operationId: 'op-stale',
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

      expect(
        sessionStorage.getItem('comfy:pending-subscription-checkout')
      ).toBeNull()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('completes a succeeded redirect silently', async () => {
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
      mockStartOperation.mockResolvedValue({ status: 'timeout' })
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
      useBillingRouting().type = computed(() => 'workspace')
      useBillingRouting().shouldUseWorkspaceBilling = computed(() => true)
      useBillingRouting().shouldUseUnifiedPricing = computed(() => true)
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
vi.mock(import('firebase/auth'))
