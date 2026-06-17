import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionDialog } from './useSubscriptionDialog'

const mockCloseDialog = vi.fn()
const mockShowLayoutDialog = vi.fn()
const mockShowTeamWorkspacesDialog = vi.fn()
const mockIsInPersonalWorkspace = vi.hoisted(() => ({ value: true }))
const mockIsFreeTier = vi.hoisted(() => ({ value: false }))
const mockSubscriptionTier = vi.hoisted(() => ({
  value: null as string | null
}))
const mockTeamWorkspacesEnabled = vi.hoisted(() => ({ value: false }))
const mockIsCloud = vi.hoisted(() => ({ value: true }))
const mockTrackPaywallViewed = vi.hoisted(() => vi.fn())

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

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get teamWorkspacesEnabled() {
        return mockTeamWorkspacesEnabled.value
      }
    }
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isFreeTier: mockIsFreeTier,
    subscriptionTier: mockSubscriptionTier
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackPaywallViewed: mockTrackPaywallViewed
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

describe('useSubscriptionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockIsInPersonalWorkspace.value = true
    mockIsFreeTier.value = false
    mockSubscriptionTier.value = null
    mockTeamWorkspacesEnabled.value = false

    try {
      sessionStorage.clear()
    } catch {
      // noop
    }
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
  })

  describe('paywall_viewed telemetry', () => {
    it('emits paywall_viewed with the reason when the pricing table opens', () => {
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'run_workflow' })

      expect(mockTrackPaywallViewed).toHaveBeenCalledTimes(1)
      expect(mockTrackPaywallViewed).toHaveBeenCalledWith({
        reason: 'run_workflow'
      })
    })

    it('defaults the reason to subscription_required when none is given', () => {
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable()

      expect(mockTrackPaywallViewed).toHaveBeenCalledWith({
        reason: 'subscription_required'
      })
    })

    it('includes the lowercased current_tier when a tier is known', () => {
      mockSubscriptionTier.value = 'CREATOR'
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'upload_model' })

      expect(mockTrackPaywallViewed).toHaveBeenCalledWith({
        reason: 'upload_model',
        current_tier: 'creator'
      })
    })

    it('does not emit paywall_viewed on non-cloud', () => {
      mockIsCloud.value = false
      const { showPricingTable } = useSubscriptionDialog()

      showPricingTable({ reason: 'member_invite' })

      expect(mockTrackPaywallViewed).not.toHaveBeenCalled()
    })

    it('emits once for the free-tier dialog and does not double-count showPricingTable', () => {
      mockIsFreeTier.value = true
      mockIsInPersonalWorkspace.value = true
      const { show } = useSubscriptionDialog()

      show({ reason: 'member_invite' })

      expect(mockTrackPaywallViewed).toHaveBeenCalledTimes(1)
      expect(mockTrackPaywallViewed).toHaveBeenCalledWith({
        reason: 'member_invite'
      })
    })

    it('emits once when show falls through to the pricing table for non-free tier', () => {
      mockIsFreeTier.value = false
      const { show } = useSubscriptionDialog()

      show({ reason: 'out_of_credits' })

      expect(mockTrackPaywallViewed).toHaveBeenCalledTimes(1)
      expect(mockTrackPaywallViewed).toHaveBeenCalledWith({
        reason: 'out_of_credits'
      })
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
