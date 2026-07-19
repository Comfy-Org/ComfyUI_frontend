import { defineAsyncComponent } from 'vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const DIALOG_KEY = 'subscription-required'
const FREE_TIER_DIALOG_KEY = 'free-tier-info'
const RESUME_PRICING_KEY = 'comfy:resume-team-pricing'

export interface SubscriptionDialogOptions {
  reason?: PaymentIntentSource
  /**
   * Forces the unified pricing dialog to open on a specific plan tab,
   * overriding the workspace-derived default (e.g. an "Upgrade to Team" CTA
   * always lands on the team tab even from a personal workspace).
   */
  planMode?: 'personal' | 'team'
}

function getInitialPlanMode(
  explicitMode: SubscriptionDialogOptions['planMode'],
  isTeamPlan: boolean,
  hasCurrentPlan: boolean,
  isPersonalWorkspace: boolean
): NonNullable<SubscriptionDialogOptions['planMode']> {
  if (explicitMode) return explicitMode
  if (isTeamPlan) return 'team'
  if (hasCurrentPlan) return 'personal'
  return isPersonalWorkspace ? 'personal' : 'team'
}

export const useSubscriptionDialog = () => {
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const workspaceStore = useTeamWorkspaceStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
    dialogStore.closeDialog({ key: FREE_TIER_DIALOG_KEY })
  }

  // Fired here — the choke point every paywall/pricing dialog variant passes
  // through — so both the legacy and workspace billing paths emit it.
  function trackModalOpened(reason?: PaymentIntentSource) {
    // Resolved lazily to avoid the useBillingContext import cycle (see below).
    const { tier } = useBillingContext()
    useTelemetry()?.trackSubscription('modal_opened', {
      current_tier: tier.value?.toLowerCase(),
      reason
    })
  }

  function showInactiveMemberDialog(): boolean {
    if (!shouldUseWorkspaceBilling.value) return false

    const { permissions } = useWorkspaceUI()
    if (permissions.value.canManageSubscription) return false

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: defineAsyncComponent(
        () =>
          import('@/platform/workspace/components/SubscriptionInactiveMemberDialog.vue')
      ),
      props: { onClose: hide },
      dialogComponentProps: {
        renderer: 'reka',
        contentClass:
          'w-[min(360px,95vw)] max-w-[min(360px,95vw)] sm:max-w-[min(360px,95vw)] border-0 bg-transparent shadow-none'
      }
    })
    return true
  }

  function showPricingTable(options?: SubscriptionDialogOptions) {
    if (!isCloud) return
    if (showInactiveMemberDialog()) return

    trackModalOpened(options?.reason)

    const legacyPricingDialogProps = {
      renderer: 'reka',
      size: 'full',
      contentClass:
        'sm:max-w-7xl max-h-[90vh] rounded-2xl border border-border-default bg-secondary-background shadow-[0_25px_80px_rgba(5,6,12,0.45)]'
    } as const

    // Jun-5 model: a single unified pricing table (personal/team plan toggle on
    // one workspace) for workspaces on the consolidated billing flow. Replaces
    // the old personal-vs-team workspace fork. Personal workspaces still on the
    // legacy flow (consolidated billing disabled) get the legacy table.
    if (shouldUseWorkspaceBilling.value) {
      // Existing per-member (legacy) team subscribers keep the old tier-based
      // team table; the unified credit-slider table is for everyone else.
      // Resolved lazily (not at composable setup): these three composables form
      // an import cycle (useBillingContext -> useWorkspaceBilling ->
      // useSubscriptionDialog), so a setup-time read would deref the shared
      // context before its state is constructed.
      const { currentPlanSlug, isLegacyTeamPlan, isTeamPlan } =
        useBillingContext()
      if (isLegacyTeamPlan.value) {
        dialogService.showLayoutDialog({
          key: DIALOG_KEY,
          component: defineAsyncComponent(
            () =>
              import('@/platform/workspace/components/SubscriptionRequiredDialogContentWorkspace.vue')
          ),
          props: {
            onClose: hide,
            reason: options?.reason
          },
          // The legacy table hosts a PrimeVue Popover teleported to body; Reka
          // modal mode traps focus and disables body pointer-events, making it
          // unclickable. The unified table has no such overlay.
          dialogComponentProps: {
            ...legacyPricingDialogProps,
            modal: false
          }
        })
        return
      }

      dialogService.showLayoutDialog({
        key: DIALOG_KEY,
        component: defineAsyncComponent(
          () =>
            import('@/platform/workspace/components/SubscriptionRequiredDialogContentUnified.vue')
        ),
        props: {
          onClose: hide,
          reason: options?.reason,
          initialPlanMode: getInitialPlanMode(
            options?.planMode,
            isTeamPlan.value,
            currentPlanSlug.value !== null,
            workspaceStore.isInPersonalWorkspace
          )
        },
        dialogComponentProps: {
          // Reka (the default renderer) sizes via size/contentClass; a PrimeVue
          // `style` width is ignored here and collapses the table to the default
          // `md` frame. `w-fit` lets each step hug its content -- the pricing
          // table fills its 1280px content while the compact confirm/success
          // steps shrink (the content root sets its own width per checkoutStep).
          renderer: 'reka',
          size: 'full',
          contentClass:
            'w-fit max-w-[min(1280px,95vw)] sm:max-w-[min(1280px,95vw)] max-h-[90vh] rounded-2xl border border-border-default bg-secondary-background shadow-[0_25px_80px_rgba(5,6,12,0.45)]'
        }
      })
      return
    }

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: defineAsyncComponent(
        () =>
          import('@/platform/cloud/subscription/components/SubscriptionRequiredDialogContent.vue')
      ),
      props: {
        onClose: hide,
        reason: options?.reason,
        onChooseTeam: () => startTeamWorkspaceUpgradeFlow()
      },
      dialogComponentProps: legacyPricingDialogProps
    })
  }

  function show(options?: SubscriptionDialogOptions) {
    if (isCloud && showInactiveMemberDialog()) return

    // Free-tier state comes from the unified facade so it works on both the
    // legacy (/customers) and workspace (/api/billing) paths. Resolved lazily
    // (not at composable setup) to avoid the useBillingContext import cycle.
    const { isFreeTier } = useBillingContext()
    if (isFreeTier.value && workspaceStore.isInPersonalWorkspace) {
      trackModalOpened(options?.reason)

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
        showPricingTable({
          reason: 'team_upgrade_resume',
          planMode: 'team'
        })
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
