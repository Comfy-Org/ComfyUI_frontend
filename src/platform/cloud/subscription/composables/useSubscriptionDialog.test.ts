import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionDialog } from './useSubscriptionDialog'

const mockCloseDialog = vi.fn()
const mockShowLayoutDialog = vi.fn()
const mockShowTeamWorkspacesDialog = vi.fn()
const mockTrackSubscription = vi.hoisted(() => vi.fn())
const mockIsInPersonalWorkspace = vi.hoisted(() => ({ value: true }))
const mockIsFreeTier = vi.hoisted(() => ({ value: false }))
const mockTier = vi.hoisted(() => ({ value: 'FREE' as string | null }))
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockIsLegacyTeamPlan = vi.hoisted(() => ({ value: false }))
const mockCanManageSubscription = vi.hoisted(() => ({ value: true }))
const mockUseWorkspaceUI = vi.hoisted(() => vi.fn())

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
    get isInPersonalWorkspace() {
      return mockIsInPersonalWorkspace.value
    }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isFreeTier: mockIsFreeTier,
    isLegacyTeamPlan: mockIsLegacyTeamPlan,
    tier: mockTier
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackSubscription: mockTrackSubscription })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: mockUseWorkspaceUI
}))

function expectRekaPricingDialogProps(
  dialogComponentProps: Record<string, unknown>
) {
  expect(dialogComponentProps).toMatchObject({
    renderer: 'reka',
    size: 'full'
  })
  expect(dialogComponentProps).not.toHaveProperty('style')
  expect(dialogComponentProps).not.toHaveProperty('pt')
}

describe('useSubscriptionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockIsInPersonalWorkspace.value = true
    mockIsFreeTier.value = false
    mockTier.value = 'FREE'
    mockShouldUseWorkspaceBilling.value = false
    mockIsLegacyTeamPlan.value = false
    mockCanManageSubscription.value = true
    mockUseWorkspaceUI.mockImplementation(() => ({
      permissions: {
        get value() {
          return { canManageSubscription: mockCanManageSubscription.value }
        }
      }
    }))

    try {
      sessionStorage.clear()
    } catch {
      // noop
    }
  })

  describe('billing context import cycle', () => {
    it('does not resolve useWorkspaceUI at composable setup', () => {
      useSubscriptionDialog()

      expect(mockUseWorkspaceUI).not.toHaveBeenCalled()
    })

    it('resolves useWorkspaceUI lazily when the pricing table is shown', () => {
      const { showPricingTable } = useSubscriptionDialog()
      expect(mockUseWorkspaceUI).not.toHaveBeenCalled()

      showPricingTable()

      expect(mockUseWorkspaceUI).toHaveBeenCalled()
    })
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
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ planMode: 'team' })

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
    })

    it('uses the legacy table (with onChooseTeam) on the legacy billing flow', () => {
      mockShouldUseWorkspaceBilling.value = false
      mockIsInPersonalWorkspace.value = true
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props).toHaveProperty('onChooseTeam')
      const { dialogComponentProps } = mockShowLayoutDialog.mock.calls[0][0]
      expectRekaPricingDialogProps(dialogComponentProps)
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

    it('keeps a non-legacy (credit-slider) team subscriber on the unified table', () => {
      mockShouldUseWorkspaceBilling.value = true
      mockIsInPersonalWorkspace.value = false
      mockIsLegacyTeamPlan.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      const props = mockShowLayoutDialog.mock.calls[0][0].props
      expect(props.initialPlanMode).toBe('team')
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

    it('does not track on non-cloud', () => {
      mockIsCloud.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'subscribe_to_run' })

      expect(mockTrackSubscription).not.toHaveBeenCalled()
    })
  })

  describe('show', () => {
    it('opens the free-tier dialog for a free-tier personal user', () => {
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = true
      const { show } = useSubscriptionDialog()

      show()

      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'free-tier-info' })
      )
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
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'free-tier-info'
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

      resumePendingPricingFlow()

      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('shows pricing table and clears intent when in team workspace', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = false

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      resumePendingPricingFlow()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBeNull()
      expect(mockShowLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'subscription-required' })
      )
    })

    it('clears intent but does not show pricing if still in personal workspace', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = true

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      resumePendingPricingFlow()

      expect(sessionStorage.getItem('comfy:resume-team-pricing')).toBeNull()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('consumes intent so second call is a no-op', () => {
      sessionStorage.setItem('comfy:resume-team-pricing', '1')
      mockIsInPersonalWorkspace.value = false

      const { resumePendingPricingFlow } = useSubscriptionDialog()
      resumePendingPricingFlow()
      mockShowLayoutDialog.mockClear()

      resumePendingPricingFlow()
      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })
  })
})
