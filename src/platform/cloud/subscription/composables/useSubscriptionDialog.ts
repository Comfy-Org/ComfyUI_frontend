import { defineAsyncComponent } from 'vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const DIALOG_KEY = 'subscription-required'
const FREE_TIER_DIALOG_KEY = 'free-tier-info'
const RESUME_PRICING_KEY = 'comfy:resume-team-pricing'

export type SubscriptionDialogReason =
  | 'subscription_required'
  | 'out_of_credits'
  | 'top_up_blocked'

export const useSubscriptionDialog = () => {
  const { flags } = useFeatureFlags()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const workspaceStore = useTeamWorkspaceStore()
  const { isFreeTier } = useSubscription()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
    dialogStore.closeDialog({ key: FREE_TIER_DIALOG_KEY })
  }

  function showPricingTable(options?: { reason?: SubscriptionDialogReason }) {
    if (!isCloud) return

    const useWorkspaceVariant =
      flags.teamWorkspacesEnabled && !workspaceStore.isInPersonalWorkspace

    const component = useWorkspaceVariant
      ? defineAsyncComponent(
          () =>
            import('@/platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue')
        )
      : defineAsyncComponent(
          () =>
            import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue')
        )

    const personalProps = {
      onClose: hide,
      reason: options?.reason,
      onChooseTeam: () => startTeamWorkspaceUpgradeFlow()
    }
    const workspaceProps = {
      onClose: hide,
      reason: options?.reason
    }

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component,
      props: useWorkspaceVariant ? workspaceProps : personalProps,
      dialogComponentProps: {
        renderer: 'reka',
        size: 'full',
        // The pricing tables host a PrimeVue Popover teleported to body.
        // Reka's modal mode traps focus and disables body pointer-events,
        // making the popover unclickable. Mirrors Settings/Manager.
        modal: false,
        contentClass:
          'w-[min(1328px,95vw)] max-w-[min(1328px,95vw)] sm:max-w-[min(1328px,95vw)] h-full max-h-[958px] overflow-hidden rounded-2xl border-border-default bg-base-background/60 shadow-[0_25px_80px_rgba(5,6,12,0.45)] backdrop-blur-md'
      }
    })
  }

  function show(options?: { reason?: SubscriptionDialogReason }) {
    if (isFreeTier.value && workspaceStore.isInPersonalWorkspace) {
      const component = defineAsyncComponent(
        () =>
          import('@/platform/cloud/subscription/components/FreeTierDialogContent.vue')
      )

      dialogService.showLayoutDialog({
        key: FREE_TIER_DIALOG_KEY,
        component,
        props: {
          reason: options?.reason,
          onClose: hide,
          onUpgrade: () => {
            hide()
            showPricingTable(options)
          }
        },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'full',
          contentClass:
            'w-[min(640px,95vw)] max-w-[min(640px,95vw)] sm:max-w-[min(640px,95vw)] overflow-hidden rounded-2xl border-border-default bg-base-background/60 shadow-[0_25px_80px_rgba(5,6,12,0.45)] backdrop-blur-md'
        }
      })
      return
    }

    showPricingTable(options)
  }

  /**
   * Start the two-stage team workspace upgrade flow:
   * 1. Close the current pricing dialog
   * 2. Open the create workspace dialog
   * 3. On successful creation, persist a resume intent so the team pricing
   *    dialog reopens automatically after the page reload
   *
   * Uses sessionStorage (not a store) because the intent must survive
   * a full page reload triggered by workspace switching.
   */
  function startTeamWorkspaceUpgradeFlow() {
    hide()
    dialogService
      .showTeamWorkspacesDialog(() => {
        try {
          sessionStorage.setItem(RESUME_PRICING_KEY, '1')
        } catch {
          // sessionStorage may be unavailable
        }
      })
      .catch((error) => {
        console.error(
          '[useSubscriptionDialog] Failed to open team workspaces dialog:',
          error
        )
        showPricingTable()
      })
  }

  /**
   * Check for and consume a pending team pricing resume intent.
   * Call once after workspace initialization on app boot.
   */
  function resumePendingPricingFlow() {
    try {
      const pending = sessionStorage.getItem(RESUME_PRICING_KEY)
      if (!pending) return
      sessionStorage.removeItem(RESUME_PRICING_KEY)

      if (!workspaceStore.isInPersonalWorkspace) {
        showPricingTable()
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }

  return {
    show,
    showPricingTable,
    hide,
    startTeamWorkspaceUpgradeFlow,
    resumePendingPricingFlow
  }
}
