import { usePaymentReturnUrlLoader } from '@/platform/cloud/subscription/composables/usePaymentReturnUrlLoader'
import { usePricingTableUrlLoader } from '@/platform/cloud/subscription/composables/usePricingTableUrlLoader'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useTopUpUrlLoader } from '@/platform/cloud/subscription/composables/useTopUpUrlLoader'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsUrlLoader } from '@/platform/settings/composables/useSettingsUrlLoader'
import { reportError } from '@/platform/telemetry/reportError'
import { useCreateWorkspaceUrlLoader } from '@/platform/workspace/composables/useCreateWorkspaceUrlLoader'
import { useInviteUrlLoader } from '@/platform/workspace/composables/useInviteUrlLoader'
import { useWorkspaceUrlLoader } from '@/platform/workspace/composables/useWorkspaceUrlLoader'

interface UrlActionStep {
  /** What the loader does, for the failure log — not shown to the customer. */
  readonly failureMessage: string
  /** `true` means a reload is already in flight: the loop must stop, since
   * `location.reload()` doesn't halt the current script and a later step's
   * own URL cleanup could otherwise land on the still-live page. */
  readonly run: () => Promise<boolean | void> | boolean | void
}

type UrlActionLoaders = {
  workspaceUrlLoader: ReturnType<typeof useWorkspaceUrlLoader> | null
  inviteUrlLoader: ReturnType<typeof useInviteUrlLoader> | null
  createWorkspaceUrlLoader: ReturnType<
    typeof useCreateWorkspaceUrlLoader
  > | null
  pricingTableUrlLoader: ReturnType<typeof usePricingTableUrlLoader> | null
  topUpUrlLoader: ReturnType<typeof useTopUpUrlLoader> | null
  settingsUrlLoader: ReturnType<typeof useSettingsUrlLoader> | null
  paymentReturnUrlLoader: ReturnType<typeof usePaymentReturnUrlLoader> | null
}

/**
 * Orders the deep-link loaders: workspace first, so `?invite`,
 * `?create_workspace`, `?pricing`, `?topup`, `?settings` all act on the
 * requested workspace rather than the one the app happened to load with.
 * Only the loaders present (cloud-gated by the caller) become steps.
 */
function buildUrlActionSteps(loaders: UrlActionLoaders): UrlActionStep[] {
  const steps: UrlActionStep[] = []

  if (loaders.workspaceUrlLoader) {
    const loader = loaders.workspaceUrlLoader
    steps.push({
      failureMessage: 'Failed to load workspace from URL:',
      run: () => loader.loadWorkspaceFromUrl()
    })
  }
  if (loaders.inviteUrlLoader) {
    const loader = loaders.inviteUrlLoader
    steps.push({
      failureMessage: 'Failed to load invite from URL:',
      run: () => loader.loadInviteFromUrl()
    })
  }
  if (loaders.createWorkspaceUrlLoader) {
    const loader = loaders.createWorkspaceUrlLoader
    steps.push({
      failureMessage: 'Failed to load create workspace from URL:',
      run: () => loader.loadCreateWorkspaceFromUrl()
    })
  }
  if (loaders.pricingTableUrlLoader) {
    const loader = loaders.pricingTableUrlLoader
    steps.push({
      failureMessage: 'Failed to load pricing table from URL:',
      run: () => loader.loadPricingTableFromUrl()
    })
  }
  // Not gated on the team-workspaces flag: it also drives personal/legacy users.
  if (loaders.topUpUrlLoader) {
    const loader = loaders.topUpUrlLoader
    steps.push({
      failureMessage: 'Failed to load top-up dialog from URL:',
      run: () => loader.loadTopUpFromUrl()
    })
  }
  if (loaders.settingsUrlLoader) {
    const loader = loaders.settingsUrlLoader
    steps.push({
      failureMessage: 'Failed to load settings panel from URL:',
      run: () => loader.loadSettingsFromUrl()
    })
  }
  // Handles the return leg of a redirect payment (Stripe appends
  // payment_intent/redirect_status params): strips the params and refreshes
  // billing status so the pending checkout resumes polling immediately.
  if (loaders.paymentReturnUrlLoader) {
    const loader = loaders.paymentReturnUrlLoader
    steps.push({
      failureMessage: 'Failed to handle payment return from URL:',
      run: () => loader.loadPaymentReturnFromUrl()
    })
  }

  return steps
}

/**
 * Runs each step in order; one loader's failure never blocks the rest. Stops
 * immediately when a step reports a reload already in flight — no further
 * step's URL cleanup should run on a page that's about to be torn down.
 * Returns whether a reload is in flight, so the caller can skip work that
 * would otherwise run against the workspace the app is switching away from.
 */
async function runUrlActionSteps(steps: UrlActionStep[]): Promise<boolean> {
  for (const step of steps) {
    try {
      if (await step.run()) return true
    } catch (error) {
      console.error(`[UrlActionLoaders] ${step.failureMessage}`, error)
    }
  }
  return false
}

/**
 * Reopens a checkout that was interrupted by a redirect payment. Called from
 * `onMounted`, not during workspace init, so the first-run and Templates
 * overlays are already settled and the recovered dialog is reachable.
 * Deliberately not awaited: the resume only settles once the recovered
 * operation reaches a terminal status, which for an abandoned checkout can
 * take hours, and the boot chain (emit('ready'), the tour, telemetry) must
 * not wait on it.
 */
function schedulePendingCheckoutRecovery(
  subscriptionDialog: ReturnType<typeof useSubscriptionDialog> | null
) {
  if (!subscriptionDialog) return

  void (async () => subscriptionDialog.resumePendingPricingFlow())().catch(
    (error) => {
      reportError(error, {
        errorType: 'billing_pending_checkout_resume_failure'
      })
    }
  )
}

/** Calls a composable only on the cloud distribution; `null` off it. */
function useIfCloud<T>(create: () => T): T | null {
  return isCloud ? create() : null
}

/**
 * Aggregates the query-param "deep link" loaders the cloud app checks on mount
 * (`?workspace`, `?invite`, `?create_workspace`, `?pricing`, `?topup`,
 * `?settings`), then recovers an interrupted checkout. The loaders are
 * instantiated in setup so their `useRoute`/`useRouter` resolve; call
 * `runUrlActionLoaders()` from `onMounted` once the app is ready.
 */
export function useUrlActionLoaders() {
  const workspaceUrlLoader = useIfCloud(useWorkspaceUrlLoader)
  const inviteUrlLoader = useIfCloud(useInviteUrlLoader)
  const createWorkspaceUrlLoader = useIfCloud(useCreateWorkspaceUrlLoader)
  const pricingTableUrlLoader = useIfCloud(usePricingTableUrlLoader)
  const topUpUrlLoader = useIfCloud(useTopUpUrlLoader)
  const settingsUrlLoader = useIfCloud(useSettingsUrlLoader)
  const paymentReturnUrlLoader = useIfCloud(usePaymentReturnUrlLoader)
  const subscriptionDialog = useIfCloud(useSubscriptionDialog)

  const steps = buildUrlActionSteps({
    workspaceUrlLoader,
    inviteUrlLoader,
    createWorkspaceUrlLoader,
    pricingTableUrlLoader,
    topUpUrlLoader,
    settingsUrlLoader,
    paymentReturnUrlLoader
  })

  async function runUrlActionLoaders() {
    const reloading = await runUrlActionSteps(steps)
    // A switch reload is already in flight: activeWorkspaceId and its auth
    // context are already stale, so starting recovery here could adopt or
    // poll the old workspace's pending checkout. The next boot, once the
    // reload lands, gets a clean pass at it.
    if (reloading) return
    schedulePendingCheckoutRecovery(subscriptionDialog)
  }

  return { runUrlActionLoaders }
}
